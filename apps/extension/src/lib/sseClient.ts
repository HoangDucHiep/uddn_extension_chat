import { isChatEvent, type ChatEvent, type ChatRequest } from '@sidekick/shared'
import { getBffUrl } from './apiClient'

/**
 * Doc SSE tu BFF.
 *
 * QUAN TRONG: streaming chay TRUC TIEP tu side panel toi BFF — KHONG proxy
 * qua service worker (MV3 SW bi kill sau ~30s).
 * Docs: docs/SYSTEM_DESIGN.md ADR-2, rule mv3-chrome.mdc §2
 */

/**
 * Loi cua luong chat — mang **error code** chuan cua server.
 *
 * Truoc day loi duoc nem bang `new Error("CODE: message")` → client phai
 * parse chuoi de biet co nen retry hay khong.nay moi la loi co **type**.
 *
 * FR-CHAT-14 / NFR-REL-02 — T-M1-19.
 */
export class ChatRequestError extends Error {
  /** Error code chuan (`ERROR_CODES` / `PROVIDER_*`). */
  readonly code: string
  /** HTTP status (neu co). */
  readonly status: number
  /** Loi co the thu lai khong. */
  readonly retryable: boolean

  constructor(code: string, message: string, status = 0, retryable = true) {
    super(message)
    this.name = 'ChatRequestError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

export interface SseClientOptions {
  /** Signal de huy stream (user bam "Dung"). */
  signal?: AbortSignal
  /** Callback cho tung event nhan duoc. */
  onEvent?: (event: ChatEvent) => void
  /**
   * Request-id do client sinh (T-M1-14 — NFR-MAINT-04).
   *
   * Gui len header `X-Request-Id` de server dung chung id → ghep duoc log
   * cua BFF, dong `request_logs` va log cua provider.
   */
  requestId?: string
}

/**
 * Sinh request-id cho 1 request (T-M1-14).
 *
 * `crypto.randomUUID()` co san trong side panel (secure context cua
 * extension). Fallback sang `Math.random` neu khong co (test env).
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Gui request chat va tra ve async generator cac ChatEvent.
 *
 * Server luon gui `meta` dau tien va `done` cuoi cung. Neu stream bi cat
 * dot ngột (network drop) → client phai coi nhu `finishReason: 'aborted'`.
 */
export async function* streamChat(
  request: ChatRequest,
  options: SseClientOptions = {},
): AsyncGenerator<ChatEvent, void, undefined> {
  const baseUrl = await getBffUrl()

  // Request-id sinh o client → gui len server qua header `X-Request-Id`
  // (T-M1-14 — NFR-MAINT-04). Server se echo lai header nay tren response.
  const requestId = options.requestId ?? generateRequestId()

  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify(request),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    // User huy → giu nguyen `AbortError` de `useChat` phan biet stop vs loi.
    if (error instanceof Error && error.name === 'AbortError') throw error
    // Khong noi duoc BFF → loi mang (retry duoc 1 lan — NFR-REL-02).
    throw new ChatRequestError(
      'SERVICE_UNAVAILABLE',
      error instanceof Error ? error.message : String(error),
      0,
      true,
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let code = 'INTERNAL_ERROR'
    let message = `HTTP ${response.status}`
    try {
      const body = JSON.parse(text) as { error?: { code?: string; message?: string } }
      code = body.error?.code ?? code
      message = body.error?.message ?? message
    } catch {
      // Body khong phai JSON → giu message mac dinh.
    }
    throw new ChatRequestError(code, message, response.status, response.status !== 401 && response.status !== 403)
  }

  if (!response.body) {
    throw new ChatRequestError('STREAM_ERROR', 'BFF khong tra ve stream', response.status, true)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      // Chu hoa CRLF — Gemini/OpenRouter mot so lan gui \r\n\r\n.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        const event = parseSseBlock(rawEvent)
        if (event) {
          options.onEvent?.(event)
          yield event
        }

        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    // Flush phan con lai.
    const tail = parseSseBlock(buffer)
    if (tail) {
      options.onEvent?.(tail)
      yield tail
    }
  } finally {
    reader.releaseLock()
  }
}

/** Parse mot khoi SSE raw thanh ChatEvent (neu hop le). */
export function parseSseBlock(raw: string): ChatEvent | undefined {
  const dataLines: string[] = []

  for (const line of raw.split(/\r?\n/)) {
    // Comment (heartbeat) — bo qua.
    if (line.startsWith(':')) continue
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return undefined

  try {
    const payload: unknown = JSON.parse(dataLines.join('\n'))
    return isChatEvent(payload) ? payload : undefined
  } catch {
    return undefined
  }
}
