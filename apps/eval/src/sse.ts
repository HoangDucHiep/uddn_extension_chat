/**
 * SSE client cho eval harness (T-M2-13).
 *
 * Doc stream SSE cua BFF (`POST /api/chat`) va do:
 *  - **TTFT** — thoi gian den token dau tien.
 *  - **latency** — thoi gian den event `done`.
 *
 * Khong dung thu vien ngoai: Node 22 co `fetch` + `ReadableStream` san.
 * Format SSE cua BFF: `event: <type>\ndata: <json>\n\n`
 *
 * Docs: docs/EVAL_PLAN.md §5.2, §6.1
 */

import { chatEventSchema, type ChatEvent, type ImageAttachment } from '@sidekick/shared'

/** Body cua `POST /api/chat` (contract dung chung voi extension). */
export interface ChatStreamRequest {
  messages: ChatStreamRequestMessage[]
  provider?: string | undefined
  model?: string | undefined
  systemPrompt?: string | undefined
  temperature?: number | undefined
  maxOutputTokens?: number | undefined
  context?: { items: unknown[] } | undefined
}

/** 1 turn gui len BFF (co the kem anh — FR-VISION-01). */
export interface ChatStreamRequestMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: ImageAttachment[] | undefined
}

/** Ket qua 1 luot stream. */
export interface ChatStreamResult {
  /** Chuoi cau tra loi (gom token delta). */
  answer: string
  /** TTFT do o client (ms) — `undefined` neu khong co token nao. */
  ttftMs?: number
  /** Tong thoi gian stream (ms) — den event `done`. */
  latencyMs: number
  /** Provider that su. */
  provider?: string
  /** Model that su. */
  model?: string
  /**
   * Chuoi provider da thu (theo thu tu) — rong neu khong co fallback.
   *
   * Chi ghi khi server phat event `provider_switch` (FR-PROVIDER-04) → biet
   * provider nao that su tra loi.
   */
  fallbackChain: string[]
  /** Token vao/ra (tu event `usage`). */
  tokensIn?: number
  tokensOut?: number
  /** Chi phi USD (tu event `usage`). */
  costUsd?: number
  /** Danh sach nguon trich dan (tu event `citation`). */
  citations: Array<{ index: number; url: string; title: string; snippet: string }>
  /** Request-id server echo lai. */
  requestId?: string
  /** Error code (neu co). */
  errorCode?: string
  /** Error message (neu co). */
  errorMessage?: string
  /** `finishReason` tu event `done`. */
  finishReason?: string
}

/** Loi khi goi BFF that bai (HTTP hoac mang). */
export class EvalChatError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'EvalChatError'
    this.status = status
  }
}

/**
 * Parse 1 block SSE raw → event domain.
 *
 * @param raw - Block SSE (nhieu dong, tach bang `\n\n`).
 * @returns Event da parse, hoac `undefined` neu block khong hop le.
 */
export function parseSseBlock(raw: string): ChatEvent | undefined {
  const dataLines: string[] = []
  let eventName: string | undefined

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return undefined

  let parsed: unknown
  try {
    parsed = JSON.parse(dataLines.join('\n'))
  } catch {
    return undefined
  }

  const result = chatEventSchema.safeParse(parsed)
  if (result.success) return result.data

  // Event khong khop schema (vd server them event moi) → bo qua thay vi
  // lam hong ca luot stream.
  void eventName
  return undefined
}

/**
 * Goi `POST /api/chat` va doc stream SSE.
 *
 * @param baseUrl - Base URL cua BFF.
 * @param request - Body cua request.
 * @param options - Tuy chon.
 * @param options.requestId - `X-Request-Id` gui len server (T-M1-14).
 * @param options.signal - Signal huy.
 */
export async function streamChat(
  baseUrl: string,
  request: ChatStreamRequest,
  options: { requestId?: string; signal?: AbortSignal } = {},
): Promise<ChatStreamResult> {
  const startedAt = Date.now()

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(options.requestId !== undefined ? { 'X-Request-Id': options.requestId } : {}),
    },
    body: JSON.stringify(request),
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new EvalChatError(
      `POST /api/chat that bai: HTTP ${response.status} ${body.slice(0, 200)}`,
      response.status,
    )
  }

  if (response.body === null) {
    throw new EvalChatError('POST /api/chat tra ve body rong', 500)
  }

  const result: ChatStreamResult = { answer: '', latencyMs: 0, citations: [], fallbackChain: [] }
  const decoder = new TextDecoder()
  let buffer = ''
  let ttftMs: number | undefined

  const reader = response.body.getReader()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex !== -1) {
      const rawBlock = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      const event = parseSseBlock(rawBlock)
      if (event !== undefined) {
        applyEvent(event, result)
        if (event.type === 'token' && ttftMs === undefined) {
          ttftMs = Date.now() - startedAt
        }
      }

      separatorIndex = buffer.indexOf('\n\n')
    }
  }

  // Flush phan con lai (truong hop khong co `\n\n` cuoi).
  const tail = parseSseBlock(buffer)
  if (tail !== undefined) applyEvent(tail, result)

  result.latencyMs = Date.now() - startedAt
  if (ttftMs !== undefined) result.ttftMs = ttftMs

  return result
}

/**
 * Ap dung 1 event SSE vao ket qua.
 *
 * @param event - Event da parse.
 * @param result - Ket qua can cap nhat.
 */
export function applyEvent(event: ChatEvent, result: ChatStreamResult): void {
  switch (event.type) {
    case 'meta':
      result.provider = event.provider
      result.model = event.model
      result.requestId = event.requestId
      break
    case 'provider_switch':
      // Server da chuyen sang provider du phong (FR-PROVIDER-04) → provider
      // trong event `meta` **khong** con la provider that su tra loi.
      result.fallbackChain.push(event.to)
      result.provider = event.to
      if (event.model !== undefined) result.model = event.model
      break
    case 'token':
      result.answer += event.delta
      break
    case 'citation':
      result.citations.push({
        index: event.index,
        url: event.url,
        title: event.title,
        snippet: event.snippet,
      })
      break
    case 'usage':
      result.tokensIn = event.tokensIn
      result.tokensOut = event.tokensOut
      result.costUsd = event.costUsd
      break
    case 'error':
      result.errorCode = event.code
      result.errorMessage = event.message
      break
    case 'done':
      result.finishReason = event.finishReason
      break
    default:
      break
  }
}
