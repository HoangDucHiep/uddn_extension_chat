/**
 * Gemini adapter — provider truc tiep tu Google (Generative Language API).
 *
 * Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
 * Key trong header `x-goog-api-key` (khong dung query string de key khong lo trong log).
 *
 * Luu y: key moi bi Google tu cho doi — `gemini-2.5-flash` / `gemini-2.5-pro`
 * tra 404 "no longer available to new users". Adapter phai discover model dong
 * va co danh sach fallback (gemini-3.6-flash -> gemini-flash-lite-latest).
 */

import type { ProviderChunk, ProviderStreamRequest } from '@sidekick/shared'
import { errorChunk, type ProviderAdapter } from './types.js'
import { mapStatusToCode, readSseData, safeReadText } from './sse.js'

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiListResponse {
  models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
}

interface GeminiPart {
  text?: string
}

interface GeminiCandidate {
  content?: { parts?: GeminiPart[] }
  finishReason?: string
}

interface GeminiStreamChunk {
  candidates?: GeminiCandidate[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  error?: { message?: string; code?: number }
}

export interface GeminiProviderOptions {
  defaultModel: string
  /** Model fallback khi model chinh loi 404/503. */
  fallbackModels?: string[]
  timeoutMs?: number
}

export class GeminiProvider implements ProviderAdapter {
  readonly id = 'gemini'
  readonly name = 'Gemini'
  readonly requiresKey = true

  private readonly options: GeminiProviderOptions

  constructor(options: GeminiProviderOptions) {
    this.options = options
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return this.preferredModels()

      const payload = (await response.json()) as GeminiListResponse
      const ids = (payload.models ?? [])
        .filter((model) => (model.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((model) => (model.name ?? '').replace(/^models\//, ''))
        .filter((id) => id.length > 0)

      return ids.length > 0 ? ids : this.preferredModels()
    } catch {
      return this.preferredModels()
    }
  }

  async *stream(request: ProviderStreamRequest): AsyncGenerator<ProviderChunk, void, undefined> {
    const candidates = this.buildModelCandidates(request.model)
    let lastError: ProviderChunk | undefined

    for (const model of candidates) {
      const result = await this.streamWithModel(model, request)

      if (result.ok) {
        yield* result.chunks
        return
      }

      lastError = result.error
      // 400/401 la loi cua request/key -> khong fallback.
      if (!result.retryable) {
        yield result.error
        return
      }
    }

    yield lastError ?? errorChunk('PROVIDER_ERROR', 'Khong nao duoc Gemini tra ve')
  }

  private preferredModels(): string[] {
    return [this.options.defaultModel, ...(this.options.fallbackModels ?? [])].filter(
      (model, index, list) => list.indexOf(model) === index,
    )
  }

  private buildModelCandidates(requestedModel: string | undefined): string[] {
    const candidates: string[] = []
    if (requestedModel) candidates.push(requestedModel)
    for (const model of this.preferredModels()) {
      if (!candidates.includes(model)) candidates.push(model)
    }
    return candidates
  }

  private async streamWithModel(
    model: string,
    request: ProviderStreamRequest,
  ): Promise<{ ok: true; chunks: ProviderChunk[] } | { ok: false; error: ProviderChunk; retryable: boolean }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 120_000)
    const onAbort = (): void => controller.abort()
    request.signal?.addEventListener('abort', onAbort, { once: true })

    // Gemini tach system prompt thanh system_instruction, con lai thanh contents.
    const systemParts = request.messages.filter((message) => message.role === 'system')
    const contents = request.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxOutputTokens !== undefined
          ? { maxOutputTokens: request.maxOutputTokens }
          : {}),
      },
    }

    if (systemParts.length > 0) {
      body['system_instruction'] = {
        parts: systemParts.map((part) => ({ text: part.content })),
      }
    }

    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'x-goog-api-key': request.apiKey ?? '',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        const retryable = response.status === 404 || response.status === 429 || response.status >= 500
        const errorText = await safeReadText(response)
        return {
          ok: false,
          error: errorChunk(
            mapStatusToCode(response.status),
            `Gemini tra loi ${response.status}: ${errorText.slice(0, 300)}`,
          ),
          retryable,
        }
      }

      if (!response.body) {
        return {
          ok: false,
          error: errorChunk('STREAM_ERROR', 'Gemini khong tra ve body'),
          retryable: true,
        }
      }

      const chunks: ProviderChunk[] = []
      for await (const data of readSseData(response.body)) {
        this.handleSseData(data, chunks)
      }
      return { ok: true, chunks }
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError'
      return {
        ok: false,
        error: errorChunk(
          isAbort ? 'TIMEOUT' : 'PROVIDER_ERROR',
          isAbort
            ? 'Gemini qua thoi gian cho'
            : `Gemini loi: ${error instanceof Error ? error.message : String(error)}`,
        ),
        retryable: true,
      }
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', onAbort)
    }
  }

  private handleSseData(data: string, chunks: ProviderChunk[]): void {
    let payload: GeminiStreamChunk
    try {
      payload = JSON.parse(data) as GeminiStreamChunk
    } catch {
      return
    }

    if (payload.error) {
      chunks.push(
        errorChunk('PROVIDER_ERROR', payload.error.message ?? 'Gemini tra loi loi'),
      )
      return
    }

    const parts = payload.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (typeof part.text === 'string' && part.text.length > 0) {
        chunks.push({ kind: 'token', text: part.text })
      }
    }

    if (payload.usageMetadata) {
      chunks.push({
        kind: 'usage',
        tokensIn: payload.usageMetadata.promptTokenCount ?? 0,
        tokensOut: payload.usageMetadata.candidatesTokenCount ?? 0,
      })
    }

    const finishReason = payload.candidates?.[0]?.finishReason
    if (typeof finishReason === 'string' && finishReason.length > 0) {
      const mapped = finishReason === 'MAX_TOKENS' ? 'length' : 'stop'
      chunks.push({ kind: 'done', finishReason: mapped })
    }
  }
}
