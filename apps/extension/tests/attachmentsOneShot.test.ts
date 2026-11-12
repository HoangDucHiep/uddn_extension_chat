import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', () => ({
  streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
  generateRequestId: () => 'req-generated-1',
  ChatRequestError: class ChatRequestError extends Error {
    code: string
    status: number
    retryable: boolean
    constructor(code: string, message: string, status = 0, retryable = true) {
      super(message)
      this.code = code
      this.status = status
      this.retryable = retryable
    }
  },
}))

const captureTabContextMock = vi.fn()
const getActiveTabIdMock = vi.fn()

vi.mock('@/lib/pageContext', () => ({
  captureTabContext: (tabId: number) => captureTabContextMock(tabId),
  getActiveTabId: () => getActiveTabIdMock(),
}))

const { useChat } = await import('../src/sidepanel/hooks/useChat')
const { useChatStore } = await import('../src/sidepanel/store/chatStore')

/**
 * Unit test **vong doi dinh kem one-shot** (FR-CONTEXT-03 — T-M3-POLISH).
 *
 * Yêu cầu user: sau khi gửi 1 tin nhắn, tab/tài liệu/ảnh đính kèm
 * **không được gửi lại** ở lượt sau và **không còn hiện** trên UI —
 * nhưng lịch sử hội thoại vẫn giữ nội dung lượt đó nên vẫn nói chuyện
 * tiếp về nó được.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.31
 */

/** Tao async generator phat tung event (gia loi SSE that). */
function makeStream(
  events: ChatEvent[],
  onEvent?: (event: ChatEvent) => void,
): AsyncGenerator<ChatEvent, void, undefined> {
  return (async function* () {
    for (const event of events) {
      onEvent?.(event)
      yield event
    }
  })()
}

const metaEvent: ChatEvent = {
  type: 'meta',
  messageId: 'msg-1',
  conversationId: 'conv-1',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  keySource: 'K1',
  requestId: 'req-1',
  turnId: 'turn-1',
}

const doneEvent: ChatEvent = {
  type: 'done',
  finishReason: 'stop',
  messageId: 'msg-1',
}

beforeEach(async () => {
  useChatStore.getState().reset()
  useChatStore.getState().clearAttachedItems()
  useChatStore.getState().clearPendingImages()
  useChatStore.getState().setContextEnabled(false)
  await chrome.storage.local.remove('sidekick.preferredProvider')
  streamChatMock.mockReset()
  captureTabContextMock.mockReset()
  getActiveTabIdMock.mockReset()
  getActiveTabIdMock.mockResolvedValue(undefined)
})

describe('one-shot attachments — dinh kem chi dung 1 lan', () => {
  it('sau khi gui → attachedItems rong (chip khong con tren UI)', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
      excerpt: 'Noi dung bai viet.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })
    expect(useChatStore.getState().attachedItems).toHaveLength(1)

    await act(async () => {
      await result.current.send('test')
    })

    expect(useChatStore.getState().attachedItems).toHaveLength(0)
  })

  it('luot thu 2 KHONG gui lai context cua lượt truoc', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
      excerpt: 'Noi dung bai viet.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })
    await act(async () => {
      await result.current.send('luot 1')
    })
    await act(async () => {
      await result.current.send('luot 2')
    })

    expect(streamChatMock).toHaveBeenCalledTimes(2)
    const first = streamChatMock.mock.calls[0]?.[0] as { context?: unknown }
    const second = streamChatMock.mock.calls[1]?.[0] as { context?: unknown }
    expect(first.context).toBeDefined()
    expect(second.context).toBeUndefined()
  })

  it('context cua lượt van nam trong lich su → van noi chuyen tiep duoc', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
      excerpt: 'Noi dung bai viet.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })
    await act(async () => {
      await result.current.send('luot 1')
    })

    const messages = useChatStore.getState().messages
    // User message + assistant message van con trong thread.
    expect(messages.length).toBeGreaterThanOrEqual(2)
    expect(messages.some((message) => message.role === 'user')).toBe(true)
  })

  it('snapshot context theo turn → "Tao lai" van gui lai context do', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
      excerpt: 'Noi dung bai viet.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })
    await act(async () => {
      await result.current.send('luot 1')
    })

    // Snapshot context theo turn.
    const state = useChatStore.getState()
    const turnId = state.messages.find((message) => message.turnId !== undefined)?.turnId
    expect(turnId).toBeDefined()

    const items = state.getTurnContext(turnId as string)
    expect(items).toHaveLength(1)
    expect(items[0]?.url).toBe('https://example.com/bai-viet')
  })

  it('context toggle (contextEnabled) khong bi reset khi tieu thu attachment', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })
    // Dinh kem item → tu bat context (chu dong muon dung).
    expect(useChatStore.getState().contextEnabled).toBe(true)

    await act(async () => {
      await result.current.send('luot 1')
    })

    // `contextEnabled` la lua chon cua user → khong bi reset khi tieu thu.
    expect(useChatStore.getState().contextEnabled).toBe(true)
  })

  it('consumeAttachments() tra ve so item da tieu thu', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })

    let consumed = 0
    act(() => {
      consumed = useChatStore.getState().consumeAttachments()
    })

    expect(consumed).toBe(1)
    expect(useChatStore.getState().attachedItems).toHaveLength(0)
  })

  it('consumeAttachments() khi khong co gi → tra 0', () => {
    let consumed = 0
    act(() => {
      consumed = useChatStore.getState().consumeAttachments()
    })

    expect(consumed).toBe(0)
  })

  it('anh cho san bi xoa sau khi gui (khong con hien tren UI)', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    act(() => {
      useChatStore.getState().addPendingImages([
        {
          id: 'img-1',
          mimeType: 'image/png',
          data: 'AAAA',
          bytes: 4,
        },
      ])
    })
    expect(useChatStore.getState().pendingImages).toHaveLength(1)

    await act(async () => {
      await result.current.send('test')
    })

    await waitFor(() => {
      expect(useChatStore.getState().pendingImages).toHaveLength(0)
    })
  })
})
