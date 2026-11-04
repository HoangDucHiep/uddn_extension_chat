import { isChatEvent, type ChatEvent, type ChatRequest } from '@sidekick/shared'
import { getBffUrl } from './apiClient'

/**
 * Doc SSE tu BFF.
 *
 * QUAN TRONG: streaming chay TRUC TIEP tu side panel toi BFF — KHONG proxy
 * qua service worker (MV3 SW bi kill sau ~30s).
 * Docs: docs/SYSTEM_DESIGN.md ADR-2, rule mv3-chrome.mdc §2
 */

export interface SseClientOptions {
  /** Signal de huy stream (user bam "Dung"). */
  signal?: AbortSignal
  /** Callback cho tung event nhan duoc. */
  onEvent?: (event: ChatEvent) => void
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

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(request),
    ...(options.signal ? { signal: options.signal } : {}),
  })

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
    throw new Error(`${code}: ${message}`)
  }

  if (!response.body) {
    throw new Error('BFF khong tra ve stream')
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
