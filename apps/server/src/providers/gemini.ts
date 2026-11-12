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
import {
  errorChunk,
  type ProviderAdapter,
  type ProviderKeyCheck,
  type ProviderModelDiscovery,
} from './types.js'
import {
  isRetryableStatus,
  mapStatusToCode,
  parseRetryAfterSeconds,
  readSseData,
  safeReadText,
  shouldTryFallbackModel,
} from './sse.js'

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

/**
 * Model Gemini **khong** ho tro `thinkingConfig`.
 *
 * Cac model "lite" (vi du `gemini-flash-lite-latest`) khong co khoi reasoning →
 * Google tra `400 INVALID_ARGUMENT` neu gui `thinkingConfig` → ca luot chat
 * that bai. Chi gui `thinkingConfig` cho model biet la ho tro thinking.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */
const GEMINI_NON_THINKING_MODEL_PATTERN = /lite/i

/**
 * Sinh `thinkingConfig` cho 1 model Gemini.
 *
 * - Model **co** thinking (`gemini-2.5-*` · `gemini-3.*`) → `thinkingBudget: 0`
 *   (mac dinh dung phan lon token cho reasoning → user chi nhan duoc text rong).
 * - Model **khong** co thinking (`*-lite`) → tra `{}` → **khong** gui field.
 *
 * LUU Y: ham tra **noi dung cua** `thinkingConfig` (khong phai `thinkingConfig`).
 * Server phai **spread vao** `generationConfig.thinkingConfig` — neu flatten
 * truc tiep, Google tra `400 INVALID_ARGUMENT` ("Unknown name thinkingBudget
 * at 'generation_config'") → ca luot chat that bai.
 *
 * @param model - Id model Gemini.
 * @returns Object `thinkingConfig` (rong neu model khong ho tro thinking).
 */
export function thinkingConfigFor(model: string): Record<string, unknown> {
  if (GEMINI_NON_THINKING_MODEL_PATTERN.test(model)) return {}
  return { thinkingBudget: 0 }
}

/**
 * Tao provider Gemini.
 */
export class GeminiProvider implements ProviderAdapter {
  readonly id = 'gemini'
  readonly name = 'Gemini'
  readonly requiresKey = true

  private readonly options: GeminiProviderOptions

  constructor(options: GeminiProviderOptions) {
    this.options = options
  }

  /** Gemini ho tro vision tren toan bo model hien tai. */
  supportsVision(_model: string): boolean {
    return true
  }

  /**
   * Kiem tra API key co hop le hay khong.
   *
   * Gemini trai key trong header `x-goog-api-key` → goi `GET /models` voi
   * header do. Key sai → 400/403.
   */
  async testKey(apiKey: string): Promise<ProviderKeyCheck> {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models`, {
        headers: {
          Accept: 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        return { ok: true }
      }

      return {
        ok: false,
        error:
          response.status === 400 || response.status === 401 || response.status === 403
            ? `Key bi tu choi (${response.status}). Kiem tra lai key cua ban.`
            : `Gemini tra loi ${response.status}`,
      }
    } catch (error) {
      return {
        ok: false,
        error: `Khong ket noi duoc Gemini: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  async listModels(apiKey?: string): Promise<string[]> {
    const result = await this.discoverModels(apiKey)
    return result.models
  }

  /**
   * Discovery danh sach model + phan biet that/fallback (T-M2-02).
   *
   * Gemini chi tra model ma key duoc xac thuc → goi `GET /models` co
   * `x-goog-api-key`. Provider loi → danh sach uu tien mac dinh (`fallback`).
   *
   * @param apiKey - API key (optional).
   */
  async discoverModels(apiKey?: string): Promise<ProviderModelDiscovery> {
    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models`, {
        headers: {
          Accept: 'application/json',
          // Key (neu co) → Gemini chi tra model ma key duoc xac thuc.
          // Khong key → 400/403 → fallback sang `preferredModels` (T-M2-02).
          ...(apiKey !== undefined && apiKey.length > 0 ? { 'x-goog-api-key': apiKey } : {}),
        },
      })
      if (!response.ok) {
        return { models: this.preferredModels(), source: 'fallback' }
      }

      const payload = (await response.json()) as GeminiListResponse
      const ids = (payload.models ?? [])
        .filter((model) => (model.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((model) => (model.name ?? '').replace(/^models\//, ''))
        .filter((id) => id.length > 0)

      return ids.length > 0
        ? { models: ids, source: 'live' }
        : { models: this.preferredModels(), source: 'fallback' }
    } catch {
      return { models: this.preferredModels(), source: 'fallback' }
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
        // Anh dinh kem → them part `inline_data` (FR-VISION-01 — T-M1-24).
        parts: [
          { text: message.content },
          ...(message.attachments ?? []).map((image) => ({
            inline_data: { mime_type: image.mimeType, data: image.data },
          })),
        ],
      }))

    const thinking = thinkingConfigFor(model)

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
        ...(request.maxOutputTokens !== undefined
          ? { maxOutputTokens: request.maxOutputTokens }
          : {}),
        // `thinkingConfig` phai **nested** trong `generationConfig` — flatten
        // truc tiep se bi Google tu choi voi `400 INVALID_ARGUMENT`.
        ...(Object.keys(thinking).length > 0 ? { thinkingConfig: thinking } : {}),
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
          // Request-id de doi chieu log provider voi `request_logs` cua
          // Sidekick (NFR-MAINT-04 — T-M1-14). Best-effort.
          ...(request.requestId !== undefined ? { 'X-Request-Id': request.requestId } : {}),
        },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        // `retryable` (fallback model) va `errorRetryable` (user retry) la 2
        // khac nhau: 429 van fallback sang model khac, nhung user phai cho.
        const retryable = shouldTryFallbackModel(response.status)
        const errorText = await safeReadText(response)
        const retryAfterSeconds =
          response.status === 429 ? parseRetryAfterSeconds(response) : undefined
        return {
          ok: false,
          error: errorChunk(
            mapStatusToCode(response.status),
            `Gemini tra loi ${response.status}: ${errorText.slice(0, 300)}`,
            {
              retryable: isRetryableStatus(response.status),
              ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
            },
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
