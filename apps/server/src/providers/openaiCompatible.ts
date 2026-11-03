/**
 * Base class dung chung cho adapter OpenAI-compatible (Groq, OpenRouter).
 * Ca hai provider deu expose API kieu OpenAI chat/completions voi SSE.
 */

import type { ProviderChunk, ProviderStreamRequest } from '@sidekick/shared'
import { mapStatusToCode, readSseData, safeReadText } from './sse.js'
import { errorChunk, type ProviderAdapter } from './types.js'

export interface OpenAiCompatibleOptions {
  id: string
  name: string
  baseUrl: string
  /** Headers them vao moi request (vd Authorization). */
  buildHeaders: (apiKey: string) => Record<string, string>
  /** Model mac dinh khi client khong chi dinh. */
  defaultModel: string
  /** Danh sach model uu tien (fallback khi model bi 404/503). */
  preferredModels: string[]
  /** Timeout cho mot request (ms). */
  timeoutMs: number
}

interface OpenAiStreamDelta {
  choices?: Array<{
    delta?: { content?: string | null }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
  error?: { message?: string; code?: string } | null
}

export class OpenAiCompatibleProvider implements ProviderAdapter {
  readonly id: string
  readonly name: string
  readonly requiresKey = true

  private readonly options: OpenAiCompatibleOptions

  constructor(options: OpenAiCompatibleOptions) {
    this.options = options
    this.id = options.id
    this.name = options.name
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.options.baseUrl}/models`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        return this.options.preferredModels
      }
      const payload: unknown = await response.json()
      const models = Array.isArray(payload)
        ? payload
        : typeof payload === 'object' && payload !== null && Array.isArray((payload as { data?: unknown }).data)
          ? (payload as { data: Array<{ id?: unknown }> }).data
          : []

      const ids = models
        .map((model) => (typeof model === 'string' ? model : (model.id ?? '')))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      return ids.length > 0 ? ids : this.options.preferredModels
    } catch {
      // Discovery that bai -> dung danh sach uu tien.
      return this.options.preferredModels
    }
  }

  /** Model mac dinh cua provider khi client khong chi dinh. */
  resolveModel(requestedModel?: string): string {
    return requestedModel ?? this.options.defaultModel
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
      // Chi fallback khi loi tam thoi (404 model, 429, 5xx). Loi 401/400 thi dung luon.
      if (!result.retryable) {
        yield result.error
        return
      }
    }

    yield lastError ?? errorChunk('PROVIDER_ERROR', 'Khong nao duoc provider tra ve')
  }

  /** Thu model theo thu tu: model yeu cau -> cac model uu tien -> model mac dinh. */
  private buildModelCandidates(requestedModel: string | undefined): string[] {
    const candidates: string[] = []
    if (requestedModel) candidates.push(requestedModel)
    for (const model of this.options.preferredModels) {
      if (!candidates.includes(model)) candidates.push(model)
    }
    if (!candidates.includes(this.options.defaultModel)) candidates.push(this.options.defaultModel)
    return candidates
  }

  private async streamWithModel(
    model: string,
    request: ProviderStreamRequest,
  ): Promise<{ ok: true; chunks: ProviderChunk[] } | { ok: false; error: ProviderChunk; retryable: boolean }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs)
    // Neu client huy (dong panel), cung huy request len provider.
    const onAbort = (): void => controller.abort()
    request.signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...this.options.buildHeaders(request.apiKey ?? ''),
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          stream: true,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxOutputTokens !== undefined ? { max_tokens: request.maxOutputTokens } : {}),
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const retryable = response.status === 404 || response.status === 429 || response.status >= 500
        const errorText = await safeReadText(response)
        return {
          ok: false,
          error: errorChunk(
            mapStatusToCode(response.status),
            `Provider ${this.id} tra loi ${response.status}: ${errorText.slice(0, 300)}`,
          ),
          retryable,
        }
      }

      if (!response.body) {
        return {
          ok: false,
          error: errorChunk('STREAM_ERROR', `Provider ${this.id} khong tra ve body`),
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
            ? `Provider ${this.id} qua thoi gian cho`
            : `Provider ${this.id} loi: ${error instanceof Error ? error.message : String(error)}`,
        ),
        // Timeout co the la do tam thoi -> cho fallback.
        retryable: true,
      }
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', onAbort)
    }
  }

  /** Xu ly mot `data:` payload cua provider, day chunk vao mang. */
  private handleSseData(data: string, chunks: ProviderChunk[]): void {
    if (data === '[DONE]') {
      chunks.push({ kind: 'done', finishReason: 'stop' })
      return
    }

    let payload: OpenAiStreamDelta
    try {
      payload = JSON.parse(data) as OpenAiStreamDelta
    } catch {
      return
    }

    if (payload.error) {
      chunks.push(
        errorChunk(
          payload.error.code ?? 'PROVIDER_ERROR',
          payload.error.message ?? `Provider ${this.id} tra loi loi`,
        ),
      )
      return
    }

    const delta = payload.choices?.[0]?.delta?.content
    if (typeof delta === 'string' && delta.length > 0) {
      chunks.push({ kind: 'token', text: delta })
    }

    if (payload.usage) {
      chunks.push({
        kind: 'usage',
        tokensIn: payload.usage.prompt_tokens ?? 0,
        tokensOut: payload.usage.completion_tokens ?? 0,
      })
    }

    const finishReason = payload.choices?.[0]?.finish_reason
    if (typeof finishReason === 'string' && finishReason.length > 0) {
      chunks.push({
        kind: 'done',
        finishReason: finishReason === 'length' ? 'length' : 'stop',
      })
    }
  }
}
