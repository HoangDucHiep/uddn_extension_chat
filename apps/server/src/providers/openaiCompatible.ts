/**
 * Base class dung chung cho adapter OpenAI-compatible (Groq, OpenRouter).
 * Ca hai provider deu expose API kieu OpenAI chat/completions voi SSE.
 */

import type { ProviderChunk, ProviderImage, ProviderStreamRequest } from '@sidekick/shared'
import {
  isRetryableStatus,
  mapStatusToCode,
  parseRetryAfterSeconds,
  readSseData,
  safeReadText,
  shouldTryFallbackModel,
} from './sse.js'
import {
  errorChunk,
  type ProviderAdapter,
  type ProviderKeyCheck,
  type ProviderModelDiscovery,
} from './types.js'

/**
 * Dung `content` cho API kieu OpenAI.
 *
 * Khong co anh → chuoi text thuan (backward compatible voi provider chi
 * nhan string). Co anh → mang parts `[{ type:'text' }, { type:'image_url' }]`.
 *
 * @param text - Noi dung text cua turn.
 * @param attachments - Anh dinh kem (base64 thuan).
 */
export function buildOpenAiContent(
  text: string,
  attachments: readonly ProviderImage[] | undefined,
): string | Array<Record<string, unknown>> {
  if (attachments === undefined || attachments.length === 0) return text

  return [
    { type: 'text', text },
    ...attachments.map((image) => ({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.data}` },
    })),
  ]
}

export interface OpenAiCompatibleOptions {
  id: string
  name: string
  baseUrl: string
  /** Headers them vao moi request (vd Authorization). */
  buildHeaders: (apiKey: string) => Record<string, string>
  /**
   * Model mac dinh khi client khong chi dinh.
   */
  defaultModel: string
  /** Danh sach model uu tien (fallback khi model bi 404/503). */
  preferredModels: string[]
  /** Timeout cho mot request (ms). */
  timeoutMs: number
  /**
   * Provider co can API key hay khong.
   *
   * Mac dinh `true`. Ollama (local) khong can key → set `false`.
   */
  requiresKey?: boolean
  /**
   * Tien to model ho tro vision (FR-VISION-01 — T-M1-24).
   *
   * Rong → provider khong ho tro anh → server bo qua provider nay khi
   * request co anh.
   */
  visionModelPrefixes?: string[]
}

interface OpenAiStreamDelta {
  choices?: Array<{
    delta?: {
      content?: string | null
      /**
       * Tool call dang stream (FR-TOOLS-02 — T-M2-07).
       *
       * `arguments` la **chuoi JSON partial** — nhieu event SSE mang tung
       * phan → phai gom theo `index` roi `JSON.parse` moi duoc.
       */
      tool_calls?: Array<{
        index?: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
  error?: { message?: string; code?: string } | null
}

/**
 * Trang thai gom tool call trong 1 request stream.
 *
 * Luu theo `index` (chi so trong mang `delta.tool_calls`) vi provider
 * co the tach 1 tool call thanh nhieu event SSE.
 */
interface ToolCallAccumulator {
  /** Id tool call do provider sinh. */
  id: string
  /** Ten tool. */
  name: string
  /** Chuoi JSON arguments chua hoan chinh — gom dan vao day. */
  argsRaw: string
}

export class OpenAiCompatibleProvider implements ProviderAdapter {
  readonly id: string
  readonly name: string
  readonly requiresKey: boolean
  /** OpenAI-compatible API ho tro function calling (FR-TOOLS-01 — T-M2-07). */
  readonly supportsTools = true

  private readonly options: OpenAiCompatibleOptions

  constructor(options: OpenAiCompatibleOptions) {
    this.options = options
    this.id = options.id
    this.name = options.name
    this.requiresKey = options.requiresKey ?? true
  }

  async listModels(apiKey?: string): Promise<string[]> {
    const result = await this.discoverModels(apiKey)
    return result.models
  }

  /**
   * Discovery danh sach model + phan biet that/fallback (T-M2-02).
   *
   * Provider goi `GET /models` **co xac thuc** → danh sach that.
   * Provider loi (401/500/network) → danh sach uu tien mac dinh (`fallback`).
   *
   * @param apiKey - API key (optional).
   */
  async discoverModels(apiKey?: string): Promise<ProviderModelDiscovery> {
    try {
      const response = await fetch(`${this.options.baseUrl}/models`, {
        headers: {
          Accept: 'application/json',
          // Key (neu co) → provider discovery that. Khong key → Groq/OpenRouter
          // tra 401 → fallback sang `preferredModels` (T-M2-02).
          ...(apiKey !== undefined && apiKey.length > 0
            ? this.options.buildHeaders(apiKey)
            : {}),
        },
      })
      if (!response.ok) {
        return { models: this.options.preferredModels, source: 'fallback' }
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

      return ids.length > 0
        ? { models: ids, source: 'live' }
        : { models: this.options.preferredModels, source: 'fallback' }
    } catch {
      // Discovery that bai -> dung danh sach uu tien.
      return { models: this.options.preferredModels, source: 'fallback' }
    }
  }

  /** Model mac dinh cua provider khi client khong chi dinh. */
  resolveModel(requestedModel?: string): string {
    return requestedModel ?? this.options.defaultModel
  }

  /**
   * Kiem tra API key co hop le hay khong.
   *
   * Provider khong can key → luon `ok: true`.
   */
  async testKey(apiKey: string): Promise<ProviderKeyCheck> {
    // Provider local (Ollama) khong can key → coi nhu hop le.
    if (!this.requiresKey) {
      return { ok: true }
    }

    try {
      const response = await fetch(`${this.options.baseUrl}/models`, {
        headers: {
          Accept: 'application/json',
          ...this.options.buildHeaders(apiKey),
        },
        signal: AbortSignal.timeout(10_000),
      })

      if (response.ok) {
        return { ok: true }
      }

      const detail = (await safeReadText(response)).slice(0, 200)
      return {
        ok: false,
        error:
          response.status === 401 || response.status === 403
            ? `Key bi tu choi (${response.status}). Kiem tra lai key cua ban.`
            : `Provider tra loi ${response.status}${detail.length > 0 ? `: ${detail}` : ''}`,
      }
    } catch (error) {
      return {
        ok: false,
        error: `Khong ket noi duoc provider: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Model co ho tro vision khong?
   *
   * Kiem tra theo tien to — provider dung chung base class nen khong the
   * goi API de hoi tung model (lat, ton tai nhung lai rat).
   */
  supportsVision(model: string): boolean {
    const prefixes = this.options.visionModelPrefixes ?? []
    return prefixes.some((prefix) => model.startsWith(prefix))
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
          // Request-id de doi chieu log provider voi `request_logs` cua
          // Sidekick (NFR-MAINT-04 — T-M1-14). Best-effort: provider co
          // the bo qua header nay.
          ...(request.requestId !== undefined ? { 'X-Request-Id': request.requestId } : {}),
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((message) => ({
            role: message.role,
            // Anh dinh kem → `content` thanh mang parts (FR-VISION-01 — T-M1-24).
            content: buildOpenAiContent(message.content, message.attachments),
            // Tool call (FR-TOOLS-02 — T-M2-07): turn `tool` can `tool_call_id`,
            // turn `assistant` can `tool_calls` de provider ghep ket qua.
            ...(message.toolCallId !== undefined
              ? { tool_call_id: message.toolCallId }
              : {}),
            ...(message.toolCalls !== undefined && message.toolCalls.length > 0
              ? {
                  tool_calls: message.toolCalls.map((call) => ({
                    id: call.id,
                    type: 'function',
                    function: {
                      name: call.name,
                      arguments: JSON.stringify(call.args ?? {}),
                    },
                  })),
                }
              : {}),
          })),
          stream: true,
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxOutputTokens !== undefined ? { max_tokens: request.maxOutputTokens } : {}),
          // Tool calling (FR-TOOLS-01/02 — T-M2-07). Chi gui khi server
          // xac nhan provider ho tro (`request.tools` da duoc loc o server).
          ...(request.tools !== undefined && request.tools.length > 0
            ? {
                tools: request.tools.map((tool) => ({
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  },
                })),
                tool_choice: 'auto',
              }
            : {}),
        }),
        signal: controller.signal,
      })

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
            `Provider ${this.id} tra loi ${response.status}: ${errorText.slice(0, 300)}`,
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
          error: errorChunk('STREAM_ERROR', `Provider ${this.id} khong tra ve body`),
          retryable: true,
        }
      }

      const chunks: ProviderChunk[] = []
      // Gom tool call theo `index` (FR-TOOLS-02 — T-M2-07).
      const toolCalls = new Map<number, ToolCallAccumulator>()
      for await (const data of readSseData(response.body)) {
        this.handleSseData(data, chunks, toolCalls)
      }
      // Tool call chi duoc emit khi stream ket thuc → args da gom day du.
      chunks.push(...this.buildToolCallChunks(toolCalls))
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

  /**
   * Xu ly mot `data:` payload cua provider, day chunk vao mang.
   *
   * @param data - Chuoi `data:` cua SSE.
   * @param chunks - Mang chunk da thu thap.
   * @param toolCalls - Accumulator gom tool call theo `index`.
   */
  private handleSseData(
    data: string,
    chunks: ProviderChunk[],
    toolCalls: Map<number, ToolCallAccumulator>,
  ): void {
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

    // Tool call (FR-TOOLS-02 — T-M2-07): gom partial theo `index`.
    const streamToolCalls = payload.choices?.[0]?.delta?.tool_calls
    if (streamToolCalls !== undefined) {
      for (const [position, entry] of streamToolCalls.entries()) {
        const index = entry.index ?? position
        const existing = toolCalls.get(index)
        const accumulator: ToolCallAccumulator = existing ?? {
          id: entry.id ?? `tool-${index}`,
          name: '',
          argsRaw: '',
        }
        if (entry.id !== undefined && entry.id.length > 0) {
          accumulator.id = entry.id
        }
        if (entry.function?.name !== undefined && entry.function.name.length > 0) {
          accumulator.name = entry.function.name
        }
        if (entry.function?.arguments !== undefined) {
          accumulator.argsRaw += entry.function.arguments
        }
        toolCalls.set(index, accumulator)
      }
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
      // `tool_calls` → model muon goi tool → server chay agent loop tiep.
      const mapped =
        finishReason === 'length' ? 'length' : finishReason === 'tool_calls' ? 'tool' : 'stop'
      chunks.push({ kind: 'done', finishReason: mapped })
    }
  }

  /**
   * Chuyen accumulator thanh chunk `tool_call`.
   *
   * Args la chuoi JSON partial → parse; parse loi → `{}` (khong lam hong
   * luot chat — model se thu lai hoac tra loi nhu binh thuong).
   *
   * @param toolCalls - Accumulator theo `index`.
   * @returns Danh sach chunk `tool_call`.
   */
  private buildToolCallChunks(
    toolCalls: ReadonlyMap<number, ToolCallAccumulator>,
  ): ProviderChunk[] {
    const chunks: ProviderChunk[] = []
    // Sort theo `index` de thu tu tool call deu determinist.
    const entries = [...toolCalls.entries()].sort((a, b) => a[0] - b[0])
    for (const [, accumulator] of entries) {
      if (accumulator.name.length === 0) continue
      chunks.push({
        kind: 'tool_call',
        toolCallId: accumulator.id,
        name: accumulator.name,
        args: parseToolArguments(accumulator.argsRaw),
      })
    }
    return chunks
  }
}

/**
 * Parse chuoi JSON arguments cua tool call.
 *
 * Args rong → `{}`. JSON hong → `{}` (khong nem loi ra ngoai).
 *
 * @param raw - Chuoi JSON (co the partial hoac rong).
 * @returns Object da parse.
 */
export function parseToolArguments(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return {}
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}
