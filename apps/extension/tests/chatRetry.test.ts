import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'
import type * as SseClientModule from '../src/lib/sseClient'
import { ChatRequestError } from '../src/lib/sseClient'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', async () => {
  const actual = await vi.importActual<typeof SseClientModule>('../src/lib/sseClient')
  return {
    ...actual,
    streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
  }
})

const captureTabContextMock = vi.fn()
const getActiveTabIdMock = vi.fn()

vi.mock('@/lib/pageContext', () => ({
  captureTabContext: (tabId: number) => captureTabContextMock(tabId),
  getActiveTabId: () => getActiveTabIdMock(),
}))

const { useChat } = await import('../src/sidepanel/hooks/useChat')
const { useChatStore } = await import('../src/sidepanel/store/chatStore')

/**
 * Unit test cho co che retry cua `useChat` (NFR-REL-02 — T-M1-19).
 *
 * - Loi mang → retry **dung 1 lan** voi backoff 800ms.
 * - Loi 401 → **KHONG** retry.
 * - Sau retry that bai → card loi hien nut "Thu lai".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.15
 */

const metaEvent: ChatEvent = {
  type: 'meta',
  messageId: '11111111-1111-4111-8111-111111111111',
  conversationId: 'conv-1',
  provider: 'groq',
  model: 'model',
  keySource: 'K1',
  requestId: 'req-1',
  turnId: 't1',
}

const doneEvent: ChatEvent = {
  type: 'done',
  finishReason: 'stop',
  messageId: '11111111-1111-4111-8111-111111111111',
}

/**
 * Tao generator nem loi ngay lap tuc.
 *
 * @param error - Loi can nem.
 */
function failingStream(error: unknown): AsyncGenerator<ChatEvent, void, undefined> {
  return (async function* () {
    throw error
    yield doneEvent
  })()
}

beforeEach(async () => {
  useChatStore.getState().reset()
  useChatStore.getState().clearAttachedItems()
  useChatStore.getState().setContextEnabled(false)
  await chrome.storage.local.remove('sidekick.preferredProvider')
  streamChatMock.mockReset()
  captureTabContextMock.mockReset()
  getActiveTabIdMock.mockReset()
  getActiveTabIdMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useChat — retry (T-M1-19)', () => {
  it('loi mang → retry DUNG 1 lan', async () => {
    streamChatMock.mockImplementation(() =>
      failingStream(new ChatRequestError('SERVICE_UNAVAILABLE', 'Mang cut', 0, true)),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    // 1 lan dau + 1 lan retry = 2.
    expect(streamChatMock).toHaveBeenCalledTimes(2)
  })

  it('loi 401 → KHONG retry', async () => {
    streamChatMock.mockImplementation(() =>
      failingStream(new ChatRequestError('INVALID_API_KEY', 'Key sai', 401, false)),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    expect(streamChatMock).toHaveBeenCalledTimes(1)
  })

  it('loi 401 → message luu errorCode + errorRetryable=false', async () => {
    streamChatMock.mockImplementation(() =>
      failingStream(new ChatRequestError('INVALID_API_KEY', 'Key sai', 401, false)),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant')
    expect(assistant?.errorCode).toBe('INVALID_API_KEY')
    expect(assistant?.errorRetryable).toBe(false)
    expect(assistant?.status).toBe('error')
  })

  it('retry that bai → van hien card loi voi nut "Thu lai"', async () => {
    streamChatMock.mockImplementation(() =>
      failingStream(new ChatRequestError('SERVICE_UNAVAILABLE', 'Mang cut', 0, true)),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant')
    expect(assistant?.status).toBe('error')
    expect(assistant?.errorRetryable).toBe(true)
  })

  it('SSE error event → luu errorCode + retryAfterSeconds', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        (async function* () {
          options.onEvent?.({
            type: 'error',
            code: 'PROVIDER_RATE_LIMITED',
            message: 'Qua tan so',
            retryable: true,
            retryAfterSeconds: 42,
          })
          yield doneEvent
        })(),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant')
    expect(assistant?.errorCode).toBe('PROVIDER_RATE_LIMITED')
    expect(assistant?.errorRetryAfterSeconds).toBe(42)
  })

  it('SSE error 401 → KHONG retry tu dong', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        (async function* () {
          options.onEvent?.({
            type: 'error',
            code: 'INVALID_API_KEY',
            message: 'Key sai',
            retryable: false,
          })
          yield doneEvent
        })(),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    expect(streamChatMock).toHaveBeenCalledTimes(1)
  })

  it('retryMessage → goi lai luot chat', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        (async function* () {
          options.onEvent?.(metaEvent)
          yield metaEvent
          yield doneEvent
        })(),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('test')
    })

    const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant')
    expect(assistant?.serverId).toBe('11111111-1111-4111-8111-111111111111')

    await act(async () => {
      await result.current.retryMessage(assistant?.id ?? '')
    })

    await waitFor(() => expect(streamChatMock).toHaveBeenCalledTimes(2))
    const secondRequest = streamChatMock.mock.calls[1]?.[0] as { operation?: string }
    expect(secondRequest.operation).toBe('regenerate')
  })
})
