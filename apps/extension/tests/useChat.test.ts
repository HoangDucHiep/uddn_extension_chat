import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', () => ({
  streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
}))

const { useChat } = await import('../src/sidepanel/hooks/useChat')
const { useChatStore } = await import('../src/sidepanel/store/chatStore')

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

beforeEach(() => {
  useChatStore.getState().reset()
  streamChatMock.mockReset()
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

  it('bo qua prompt rong', async () => {
    const { result } = renderHook(() => useChat())
    await act(async () => {
      await result.current.send('   ')
    })
    expect(streamChatMock).not.toHaveBeenCalled()
    expect(useChatStore.getState().messages).toHaveLength(0)
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
})
