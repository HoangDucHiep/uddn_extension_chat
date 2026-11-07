import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', () => ({
  streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
  generateRequestId: () => 'req-generated-1',
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
 * Unit test cho cac thao tac chat cua T-M1-10:
 * regenerate · edit & resend (branch) · continue · stop → aborted.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.11
 */

/**
 * Tao async generator phat tung event (goi `onEvent` truoc khi yield).
 *
 * @param events - Danh sach event.
 * @param onEvent - Callback nhan event.
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

const metaEvent = (turnId?: string): ChatEvent => ({
  type: 'meta',
  messageId: 'msg-1',
  conversationId: 'conv-1',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  keySource: 'K1',
  requestId: 'req-1',
  ...(turnId !== undefined ? { turnId } : {}),
})

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

/** Id server (uuid) cua assistant message `a1` — T-M1-19. */
const SERVER_ID_A1 = '11111111-1111-4111-8111-111111111111'

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

describe('useChat — chat actions (T-M1-10)', () => {
  it('regenerate gui operation regenerate + assistantMessageId', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        makeStream([metaEvent('t1'), tokenEvent('cau tra loi moi'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    // Tao san 1 turn da co assistant message.
    // `serverId` = uuid tu server → `regenerate` gui id nay len BFF (T-M1-19).
    act(() => {
      useChatStore.getState().addMessage({
        id: 'u1',
        role: 'user',
        content: 'cau hoi',
        createdAt: 1,
        status: 'done',
        turnId: 't1',
      })
      useChatStore.getState().addMessage({
        id: 'a1',
        role: 'assistant',
        content: 'cau tra loi cu',
        createdAt: 2,
        status: 'done',
        turnId: 't1',
        variantIndex: 0,
        active: true,
        serverId: SERVER_ID_A1,
      })
    })
    useChatStore.getState().hydratePath(['t1'])

    await act(async () => {
      await result.current.regenerate('a1')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      operation?: string
      assistantMessageId?: string
    }
    expect(request.operation).toBe('regenerate')
    expect(request.assistantMessageId).toBe(SERVER_ID_A1)
  })

  it('regenerate: bien the cu chuyen active=false', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        makeStream([metaEvent('t1'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    act(() => {
      useChatStore.getState().addMessage({
        id: 'a1',
        role: 'assistant',
        content: 'cau tra loi cu',
        createdAt: 2,
        status: 'done',
        turnId: 't1',
        variantIndex: 0,
        active: true,
        serverId: SERVER_ID_A1,
      })
    })
    useChatStore.getState().hydratePath(['t1'])

    await act(async () => {
      await result.current.regenerate('a1')
    })

    const oldVariant = useChatStore
      .getState()
      .messages.find((message) => message.id === 'a1')
    expect(oldVariant?.active).toBe(false)
  })

  it('editAndResend gui operation branch + parentTurnId', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        makeStream([metaEvent('t2'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    act(() => {
      useChatStore.getState().addMessage({
        id: 'u1',
        role: 'user',
        content: 'cau hoi cu',
        createdAt: 1,
        status: 'done',
        turnId: 't1',
      })
      useChatStore.getState().addMessage({
        id: 'u2',
        role: 'user',
        content: 'cau hoi moi',
        createdAt: 3,
        status: 'done',
        turnId: 't2',
      })
    })
    useChatStore.getState().hydratePath(['t1', 't2'])

    await act(async () => {
      await result.current.editAndResend('u2', 'cau hoi sua lai')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      operation?: string
      parentTurnId?: string
      messages: Array<{ role: string; content: string }>
    }
    expect(request.operation).toBe('branch')
    expect(request.parentTurnId).toBe('t2')
    // Noi dung moi duoc gui len.
    expect(request.messages[request.messages.length - 1]?.content).toBe(
      'cau hoi sua lai',
    )
  })

  it('editAndResend cat duong di tai turn cha', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        makeStream([metaEvent('t2'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    act(() => {
      useChatStore.getState().addMessage({
        id: 'u1',
        role: 'user',
        content: 'cau 1',
        createdAt: 1,
        status: 'done',
        turnId: 't1',
      })
      useChatStore.getState().addMessage({
        id: 'u2',
        role: 'user',
        content: 'cau 2',
        createdAt: 2,
        status: 'done',
        turnId: 't2',
      })
      useChatStore.getState().addMessage({
        id: 'a2',
        role: 'assistant',
        content: 'tra loi 2',
        createdAt: 3,
        status: 'done',
        turnId: 't2',
        variantIndex: 0,
        active: true,
      })
    })
    useChatStore.getState().hydratePath(['t1', 't2'])

    await act(async () => {
      await result.current.editAndResend('u2', 'cau 2 sua')
    })

    const state = useChatStore.getState()
    // Turn 't2' khong con nam tren duong di active.
    expect(state.path).not.toContain('t2')
    const cut = state.messages.find((message) => message.id === 'a2')
    expect(cut?.active).toBe(false)
  })

  it('continueAnswer gui operation continue + assistantMessageId', async () => {
    streamChatMock.mockImplementation(
      (_request: unknown, options: { onEvent?: (event: ChatEvent) => void }) =>
        makeStream([metaEvent('t1'), tokenEvent(' phan con'), doneEvent], options.onEvent),
    )

    const { result } = renderHook(() => useChat())

    act(() => {
      useChatStore.getState().addMessage({
        id: 'u1',
        role: 'user',
        content: 'cau hoi',
        createdAt: 1,
        status: 'done',
        turnId: 't1',
      })
      useChatStore.getState().addMessage({
        id: 'a1',
        role: 'assistant',
        content: 'phan bi ngat',
        createdAt: 2,
        status: 'done',
        turnId: 't1',
        variantIndex: 0,
        active: true,
        aborted: true,
        serverId: SERVER_ID_A1,
      })
    })
    useChatStore.getState().hydratePath(['t1'])

    await act(async () => {
      await result.current.continueAnswer('a1')
    })

    const request = streamChatMock.mock.calls[0]?.[0] as {
      operation?: string
      assistantMessageId?: string
    }
    expect(request.operation).toBe('continue')
    expect(request.assistantMessageId).toBe(SERVER_ID_A1)

    // Token duoc append vao message dang co (khong tao message moi).
    const assistant = useChatStore
      .getState()
      .messages.find((message) => message.id === 'a1')
    expect(assistant?.content).toContain('phan bi ngat')
    expect(assistant?.content).toContain('phan con')
    expect(assistant?.aborted).toBe(false)
  })

  it('stop → message giu nguyen noi dung do + aborted=true', async () => {
    let capturedSignal: AbortSignal | undefined
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { signal?: AbortSignal; onEvent?: (event: ChatEvent) => void },
      ) => {
        capturedSignal = options.signal
        options.onEvent?.(tokenEvent('phan dau'))
        return (async function* () {
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
    expect(assistant?.content).toBe('phan dau')
    expect(assistant?.aborted).toBe(true)
    expect(assistant?.status).toBe('done')
  })

  it('activateVariant doi co bien the active', () => {
    const { result } = renderHook(() => useChat())

    act(() => {
      useChatStore.getState().addMessage({
        id: 'a0',
        role: 'assistant',
        content: 'v0',
        createdAt: 1,
        status: 'done',
        turnId: 't1',
        variantIndex: 0,
        active: true,
      })
      useChatStore.getState().addMessage({
        id: 'a1',
        role: 'assistant',
        content: 'v1',
        createdAt: 2,
        status: 'done',
        turnId: 't1',
        variantIndex: 1,
        active: false,
      })
    })

    act(() => {
      result.current.activateVariant('t1', 1)
    })

    const messages = useChatStore.getState().messages
    expect(messages.find((m) => m.id === 'a0')?.active).toBe(false)
    expect(messages.find((m) => m.id === 'a1')?.active).toBe(true)
  })

  it('setConversationPath nap duong di active', () => {
    const { result } = renderHook(() => useChat())

    act(() => {
      result.current.setConversationPath(['t1', 't2'])
    })

    expect(useChatStore.getState().path).toEqual(['t1', 't2'])
  })
})
