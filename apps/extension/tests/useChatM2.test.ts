import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', () => ({
  streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
  generateRequestId: () => 'req-generated-m2',
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

const toastWarningMock = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: (message: string) => toastWarningMock(message),
  },
}))

const { useChat } = await import('../src/sidepanel/hooks/useChat')
const { useChatStore } = await import('../src/sidepanel/store/chatStore')
const { MODEL_SELECTION_STORAGE_KEY } = await import('../src/lib/modelSelection')

/**
 * Unit test cho T-M2-02 (model picker + fallback) va T-M2-03 (chi phi) —
 * phia extension.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22, §7.23
 */

/**
 * Tao async generator phat tung event.
 *
 * @param events - Danh sach event phat ra.
 * @param onEvent - Callback server gui (tu `streamChat` that).
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
  conversationId: 'conv-m2',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  keySource: 'K1',
  requestId: 'req-m2',
}

const tokenEvent = (delta: string): ChatEvent => ({
  type: 'token',
  delta,
  index: 0,
})

const doneEvent: ChatEvent = {
  type: 'done',
  finishReason: 'stop',
  messageId: 'msg-1',
}

beforeEach(async () => {
  useChatStore.getState().reset()
  useChatStore.getState().clearAttachedItems()
  useChatStore.getState().setContextEnabled(false)
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all))
  streamChatMock.mockReset()
  toastWarningMock.mockReset()
  captureTabContextMock.mockReset()
  getActiveTabIdMock.mockReset()
  getActiveTabIdMock.mockResolvedValue(undefined)
})

describe('useChat — model picker (T-M2-02)', () => {
  it('gui provider + model da chon tu model picker len BFF', async () => {
    await chrome.storage.local.set({
      [MODEL_SELECTION_STORAGE_KEY]: { providerId: 'gemini', model: 'gemini-3.6-flash' },
    })

    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, tokenEvent('Chao'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('Chao')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      provider?: string
      model?: string
    }
    expect(request.provider).toBe('gemini')
    expect(request.model).toBe('gemini-3.6-flash')
  })

  it('KHONG gui provider/model khi user chua chon gi', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) => makeStream([metaEvent, tokenEvent('Chao'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('Chao')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      provider?: string
      model?: string
    }
    expect(request.provider).toBeUndefined()
    expect(request.model).toBeUndefined()
  })
})

describe('useChat — provider switch (FR-PROVIDER-04 — T-M2-02)', () => {
  it('nhan event provider_switch → cap nhat provider + hien toast', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [
            metaEvent,
            {
              type: 'provider_switch',
              from: 'groq',
              to: 'openrouter',
              reason: 'RATE_LIMITED',
              model: 'google/gemini-2.5-flash',
            },
            tokenEvent('Chao'),
            doneEvent,
          ],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('Chao')
    })

    await waitFor(() => {
      expect(useChatStore.getState().activeProvider).toBe('openrouter')
    })
    expect(useChatStore.getState().activeModel).toBe('google/gemini-2.5-flash')

    const messages = useChatStore.getState().messages
    expect(messages[1]?.provider).toBe('openrouter')
    expect(messages[1]?.model).toBe('google/gemini-2.5-flash')

    expect(toastWarningMock).toHaveBeenCalled()
  })
})

describe('useChat — chi phi (T-M2-03)', () => {
  it('luu costUsd tu event usage vao message assistant', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [
            metaEvent,
            tokenEvent('Chao'),
            { type: 'usage', tokensIn: 120, tokensOut: 45, costUsd: 0.0123 },
            doneEvent,
          ],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('Chao')
    })

    const messages = useChatStore.getState().messages
    expect(messages[1]?.tokensIn).toBe(120)
    expect(messages[1]?.tokensOut).toBe(45)
    expect(messages[1]?.costUsd).toBe(0.0123)
  })
})
