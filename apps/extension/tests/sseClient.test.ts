import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateRequestId, parseSseBlock, streamChat } from '../src/lib/sseClient'
import type { ChatEvent } from '@sidekick/shared'

/**
 * Unit test cho SSE parser cua extension.
 * Docs: docs/SYSTEM_DESIGN.md §4.1 (SSE 8 event)
 */

const metaEvent: ChatEvent = {
  type: 'meta',
  messageId: 'msg-1',
  conversationId: 'conv-1',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  keySource: 'K1',
  requestId: 'req-1',
}

const tokenEvent: ChatEvent = { type: 'token', delta: 'Xin', index: 0 }

describe('parseSseBlock', () => {
  it('parse event `data:` hop le', () => {
    const raw = `data: ${JSON.stringify(metaEvent)}`
    expect(parseSseBlock(raw)).toEqual(metaEvent)
  })

  it('bo qua comment heartbeat', () => {
    const raw = `: ping\ndata: ${JSON.stringify(metaEvent)}`
    expect(parseSseBlock(raw)).toEqual(metaEvent)
  })

  it('tra undefined khi khong co dong `data:`', () => {
    expect(parseSseBlock('event: token')).toBeUndefined()
    expect(parseSseBlock('')).toBeUndefined()
  })

  it('tra undefined khi JSON khong hop le', () => {
    expect(parseSseBlock('data: {khong-hop-le')).toBeUndefined()
  })

  it('tra undefined khi payload khong phai ChatEvent hop le', () => {
    expect(parseSseBlock('data: {"type":"unknown_event"}')).toBeUndefined()
    expect(parseSseBlock('data: {"foo":"bar"}')).toBeUndefined()
  })

  it('tra undefined khi event thieu field bat buoc', () => {
    // Thieu `keySource` → schema fail → undefined.
    expect(parseSseBlock('data: {"type":"meta","conversationId":"c"}')).toBeUndefined()
  })

  it('parse token event', () => {
    expect(parseSseBlock(`data: ${JSON.stringify(tokenEvent)}`)).toEqual(tokenEvent)
  })
})

describe('generateRequestId', () => {
  it('sinh id khac nhau moi lan', () => {
    const first = generateRequestId()
    const second = generateRequestId()

    expect(first).not.toBe(second)
  })

  it('id khong rong va an toan (chi ky tu in duoc)', () => {
    const id = generateRequestId()

    expect(id.length).toBeGreaterThan(0)
    expect(id).toMatch(/^[A-Za-z0-9._:/-]+$/)
  })
})

describe('streamChat — X-Request-Id', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Response gia lap voi body SSE rong. */
  function makeStreamResponse(): Response {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }

  it('gui header `X-Request-Id` khi client truyen requestId', async () => {
    fetchMock.mockResolvedValue(makeStreamResponse())

    const generator = streamChat(
      { messages: [{ role: 'user', content: 'Xin chao' }] },
      { requestId: 'req-fixed-123' },
    )
    // Keu `next` de fetch chay.
    await generator.next()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['X-Request-Id']).toBe('req-fixed-123')
  })

  it('tu sinh requestId khi client khong truyen', async () => {
    fetchMock.mockResolvedValue(makeStreamResponse())

    const generator = streamChat({ messages: [{ role: 'user', content: 'Xin chao' }] })
    await generator.next()

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    const sentId = headers['X-Request-Id']
    expect(sentId).toBeDefined()
    expect(sentId?.length ?? 0).toBeGreaterThan(0)
  })

  it('server echo header → id cua server la nguon su that (qua SSE `meta`)', async () => {
    const metaWithServerId: ChatEvent = {
      type: 'meta',
      messageId: 'msg-1',
      conversationId: 'conv-1',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      keySource: 'K1',
      requestId: 'req-server-456',
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(metaWithServerId)}\n\n`))
        controller.close()
      },
    })
    fetchMock.mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )

    const generator = streamChat(
      { messages: [{ role: 'user', content: 'Xin chao' }] },
      { requestId: 'req-client-789' },
    )
    const result = await generator.next()

    expect(result.value?.type).toBe('meta')
    if (result.value?.type === 'meta') {
      expect(result.value.requestId).toBe('req-server-456')
    }
  })
})
