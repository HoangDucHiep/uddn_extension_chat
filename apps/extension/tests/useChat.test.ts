import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', () => ({
  streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
}))

const captureTabContextMock = vi.fn()
const getActiveTabIdMock = vi.fn()

vi.mock('@/lib/pageContext', () => ({
  captureTabContext: (tabId: number) => captureTabContextMock(tabId),
  getActiveTabId: () => getActiveTabIdMock(),
}))

const { useChat } = await import('../src/sidepanel/hooks/useChat')
const { useChatStore } = await import('../src/sidepanel/store/chatStore')
const { writePreferredProvider } = await import('../src/lib/onboarding')

/**
 * Unit test cho hook `useChat` — luong gui prompt va nhan stream.
 * Docs: docs/SYSTEM_DESIGN.md §4.3
 */

/**
 * Tao async generator phat tung event.
 * Moi event duoc goi qua `onEvent` truoc khi yield — giong hanh vi
 * `streamChat` that (vua callback vua yield cung mot event).
 */
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
}

const tokenEvent = (delta: string): ChatEvent => ({
  type: 'token',
  delta,
  index: 0,
})

const usageEvent: ChatEvent = {
  type: 'usage',
  tokensIn: 5,
  tokensOut: 3,
  costUsd: 0,
}

const doneEvent: ChatEvent = {
  type: 'done',
  finishReason: 'stop',
  messageId: 'msg-1',
}

beforeEach(async () => {
  useChatStore.getState().reset()
  // Reset giu nguyen context da dinh kem → don de dam bao test doc lap.
  useChatStore.getState().clearAttachedItems()
  useChatStore.getState().setContextEnabled(false)
  // Xoa provider uu tien (onboarding) → moi test doc lap.
  await chrome.storage.local.remove('sidekick.preferredProvider')
  streamChatMock.mockReset()
  captureTabContextMock.mockReset()
  getActiveTabIdMock.mockReset()
  // Mac dinh khong co tab active → khong tao item nao.
  getActiveTabIdMock.mockResolvedValue(undefined)
})

describe('useChat', () => {
  it('gui prompt: tao message user + assistant, nhan token', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, tokenEvent('Xin '), tokenEvent('chao'), usageEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('Xin chao')
    })

    const messages = useChatStore.getState().messages
    expect(messages).toHaveLength(2)
    expect(messages[0]?.role).toBe('user')
    expect(messages[0]?.content).toBe('Xin chao')
    expect(messages[1]?.role).toBe('assistant')
    expect(messages[1]?.content).toBe('Xin chao')
    expect(messages[1]?.status).toBe('done')
    expect(messages[1]?.provider).toBe('groq')
    expect(messages[1]?.model).toBe('openai/gpt-oss-120b')
    expect(messages[1]?.tokensOut).toBe(3)

    expect(useChatStore.getState().conversationId).toBe('conv-1')
    expect(useChatStore.getState().activeProvider).toBe('groq')
    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  it('gui prompt kem anh: anh duoc gui len BFF + hien thi trong message', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, tokenEvent('ok'), doneEvent], options.onEvent),
    )

    const attachment = {
      id: '11111111-2222-4333-8444-555555555555',
      mimeType: 'image/png' as const,
      data: 'aGVsbG8=',
      bytes: 5,
    }
    useChatStore.getState().addPendingImages([attachment])

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('Mo ta anh nay')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      messages: Array<{
        role: string
        content: string
        attachments?: Array<{ id: string; data: string }>
      }>
    }
    const lastTurn = request.messages[request.messages.length - 1]
    expect(lastTurn?.attachments).toHaveLength(1)
    expect(lastTurn?.attachments?.[0]?.id).toBe(attachment.id)

    // Tray xoa sau khi gui.
    expect(useChatStore.getState().pendingImages).toHaveLength(0)

    // Message user hien thi anh.
    const userMessage = useChatStore.getState().messages[0]
    expect(userMessage?.images).toHaveLength(1)
    expect(userMessage?.images?.[0]?.dataUrl).toBe(
      'data:image/png;base64,aGVsbG8=',
    )
  })

  it('gui chi anh (khong co text) van hop le', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    useChatStore.getState().addPendingImages([
      {
        id: '11111111-2222-4333-8444-555555555555',
        mimeType: 'image/png',
        data: 'aGVsbG8=',
        bytes: 5,
      },
    ])

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('')
    })

    expect(streamChatMock).toHaveBeenCalled()
    const request = streamChatMock.mock.calls[0]?.[0] as {
      messages: Array<{ content: string; attachments?: unknown[] }>
    }
    const lastTurn = request.messages[request.messages.length - 1]
    expect(lastTurn?.attachments).toHaveLength(1)
    expect(lastTurn?.content.length).toBeGreaterThan(0)
  })

  it('bo qua prompt rong', async () => {    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('   ')
    })
    expect(streamChatMock).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages).toHaveLength(0)
  })

  it('khong gui message assistant rong len BFF (server yeu cau content >= 1 ky tu)', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('Xin chao')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      messages: Array<{ role: string; content: string }>
    }
    expect(request.messages).toHaveLength(1)
    expect(request.messages[0]?.role).toBe('user')
    expect(request.messages[0]?.content).toBe('Xin chao')
    // Moi message gui len deu co content khong rong.
    for (const message of request.messages) {
      expect(message.content.trim().length).toBeGreaterThan(0)
    }
  })

  it('event error gan errorMessage va status error', async () => {
    const errorEvent: ChatEvent = {
      type: 'error',
      code: 'PROVIDER_ERROR',
      message: 'Het credit',
      retryable: false,
    }

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [errorEvent, { ...doneEvent, finishReason: 'error' }],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.status).toBe('error')
    expect(assistant?.errorMessage).toBe('Het credit')
  })

  it('stream bi cut dot ngot → van dong status done', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([tokenEvent('partial')], options.onEvent),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.status).toBe('done')
    expect(assistant?.content).toBe('partial')
  })

  it('stop huy stream → status done, khong error', async () => {
    let capturedSignal: AbortSignal | undefined
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { signal?: AbortSignal; onEvent?: (event: ChatEvent) => void },
      ) => {
        capturedSignal = options.signal
        options.onEvent?.(tokenEvent('a'))
        // Cho signal bi abort -> generator nem loi AbortError.
      return (async function* () {
        options.onEvent?.(tokenEvent('a'))
        // Cho signal bi abort -> generator nem loi AbortError.
        await new Promise<void>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
        yield doneEvent
      })()
      },
    )

    const { result } = renderHook(() => useChat())
    let pending: Promise<void> = Promise.resolve()
    await act(async () => {
      pending = result.current.send('test')
    })

    await waitFor(() => expect(capturedSignal).toBeDefined())
    act(() => {
      result.current.stop()
    })
    await act(async () => {
      await pending
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.status).toBe('done')
    expect(assistant?.errorMessage).toBeUndefined()
  })

  it('clear xoa toan bo cuoc tro chuyen', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([doneEvent], options.onEvent),
    )
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })
    expect(useChatStore.getState().messages.length).toBeGreaterThan(0)

    act(() => {
      result.current.clear()
    })
    expect(useChatStore.getState().messages).toHaveLength(0)
  })

  it('khong gui context khi user chua dinh kem gi (FR-CONTEXT-07)', async () => {
    getActiveTabIdMock.mockResolvedValue(42)
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Tieu de bai viet',
      tabId: 42,
      text: 'Noi dung chinh cua trang.',
      excerpt: 'Noi dung chinh cua trang.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as { context?: unknown }
    // Khong tu capture tab → chat thuan LLM.
    expect(request.context).toBeUndefined()
    expect(captureTabContextMock).not.toHaveBeenCalled()
  })

  it('gui context khi user da dinh kem tab', async () => {
    getActiveTabIdMock.mockResolvedValue(42)
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Tieu de bai viet',
      tabId: 42,
      text: 'Noi dung chinh cua trang.',
      excerpt: 'Noi dung chinh cua trang.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachCurrentTab()
    })

    await act(async () => {
      await result.current.send('test')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      context?: { items?: Array<{ tier?: string; url?: string; text?: string }> }
    }
    expect(request.context?.items).toHaveLength(1)
    expect(request.context?.items?.[0]?.tier).toBe('attachment')
    expect(request.context?.items?.[0]?.url).toBe('https://example.com/bai-viet')
    expect(request.context?.items?.[0]?.text).toBe('Noi dung chinh cua trang.')
  })

  it('tat context → khong gui context du co item dinh kem', async () => {
    getActiveTabIdMock.mockResolvedValue(42)
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Tieu de bai viet',
      tabId: 42,
      text: 'Noi dung chinh cua trang.',
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachCurrentTab()
    })
    act(() => {
      result.current.setContextEnabled(false)
    })

    await act(async () => {
      await result.current.send('test')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as { context?: unknown }
    expect(request.context).toBeUndefined()
  })

  it('chat van chay duoc khi capture context that bai', async () => {
    getActiveTabIdMock.mockResolvedValue(42)
    captureTabContextMock.mockRejectedValue(new Error('khong doc duoc trang'))

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, tokenEvent('ok'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.status).toBe('done')
    expect(assistant?.content).toBe('ok')
  })

  it('attachTab dinh kem mot tab bat ky vao context (T-M1-05)', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
      text: 'Noi dung bai viet.',
      excerpt: 'Noi dung bai viet.',
      sourceKind: 'html',
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })

    const items = useChatStore.getState().attachedItems
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('tab-77')
    expect(items[0]?.tabId).toBe(77)
    expect(items[0]?.tier).toBe('attachment')
  })

  it('attachTab KHONG capture lai tab da dinh kem roi', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 77,
    })

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.attachTab(77)
    })
    captureTabContextMock.mockClear()

    await act(async () => {
      await result.current.attachTab(77)
    })

    expect(captureTabContextMock).not.toHaveBeenCalled()
    expect(useChatStore.getState().attachedItems).toHaveLength(1)
  })

  it('attachTab gui item dinh kem len BFF khi gui tin nhan', async () => {
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
    await act(async () => {
      await result.current.send('test')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      context?: { items?: Array<{ url?: string; tier?: string }> }
    }
    expect(request.context?.items).toHaveLength(1)
    expect(request.context?.items?.[0]?.url).toBe('https://example.com/bai-viet')
    expect(request.context?.items?.[0]?.tier).toBe('attachment')
  })

  it('gui provider uu tien tu onboarding len BFF (T-M1-25 — FR-PROVIDER-04)', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    // User chon Ollama trong buoc 2 cua onboarding.
    await writePreferredProvider('ollama')

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as { provider?: string }
    expect(request.provider).toBe('ollama')
  })

  it('khong co provider uu tien → request khong gui field provider', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('test')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as { provider?: string }
    expect(request.provider).toBeUndefined()
  })
})
