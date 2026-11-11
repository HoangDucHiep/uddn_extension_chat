import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ChatEvent } from '@sidekick/shared'

const streamChatMock = vi.fn()

vi.mock('@/lib/sseClient', () => ({
  streamChat: (request: unknown, options: unknown) => streamChatMock(request, options),
  generateRequestId: () => 'req-generated-tools',
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

const { useChat } = await import('../src/sidepanel/hooks/useChat')
const { useChatStore } = await import('../src/sidepanel/store/chatStore')

/**
 * Unit test cho xu ly SSE tool trong `useChat` (FR-TOOLS-02/04 — T-M2-09).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.5
 */

/**
 * Tao async generator phat tung event.
 *
 * @param events - Danh sach event phat ra.
 * @param onEvent - Callback server gui.
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
  conversationId: 'conv-tools',
  provider: 'groq',
  model: 'gpt-oss-120b',
  keySource: 'K1',
  requestId: 'req-tools',
}

const doneEvent: ChatEvent = {
  type: 'done',
  finishReason: 'stop',
  messageId: 'msg-1',
}

beforeEach(async () => {
  useChatStore.getState().reset()
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all))
  streamChatMock.mockReset()
})

describe('useChat — tool call (FR-TOOLS-02 — T-M2-09)', () => {
  it('nhan event tool_call → them tool call vao message assistant', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [
            metaEvent,
            {
              type: 'tool_call',
              id: 'call-1',
              name: 'calculator',
              args: { expression: '2+2' },
              approvalRequired: false,
            },
            doneEvent,
          ],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('2+2 bang bao nhieu')
    })

    const messages = useChatStore.getState().messages
    const assistant = messages[1]
    expect(assistant?.toolCalls).toHaveLength(1)
    expect(assistant?.toolCalls?.[0]?.name).toBe('calculator')
    expect(assistant?.toolCalls?.[0]?.id).toBe('call-1')
    expect(assistant?.toolCalls?.[0]?.approvalRequired).toBe(false)
  })

  it('nhan event tool_result → cap nhat output + ok', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [
            metaEvent,
            {
              type: 'tool_call',
              id: 'call-1',
              name: 'calculator',
              args: { expression: '2+2' },
              approvalRequired: false,
            },
            {
              type: 'tool_result',
              id: 'call-1',
              ok: true,
              output: '4',
              durationMs: 12,
            },
            doneEvent,
          ],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('2+2 bang bao nhieu')
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.toolCalls?.[0]?.output).toBe('4')
    expect(assistant?.toolCalls?.[0]?.ok).toBe(true)
    expect(assistant?.toolCalls?.[0]?.durationMs).toBe(12)
    expect(assistant?.toolCalls?.[0]?.status).toBe('ok')
  })

  it('tool loi → status error, luot chat van khong hong', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [
            metaEvent,
            {
              type: 'tool_call',
              id: 'call-1',
              name: 'calculator',
              args: { expression: '1/0' },
              approvalRequired: false,
            },
            {
              type: 'tool_result',
              id: 'call-1',
              ok: false,
              output: 'Chia cho 0 khong hop le',
              durationMs: 3,
            },
            { type: 'token', delta: 'Khong chia duoc', index: 0 },
            doneEvent,
          ],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('1/0 bang bao nhieu')
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.toolCalls?.[0]?.ok).toBe(false)
    expect(assistant?.toolCalls?.[0]?.status).toBe('error')
    expect(assistant?.status).toBe('done')
    expect(assistant?.content).toContain('Khong chia duoc')
  })

  it('nhan event tool_approval → gan approvalRequired + badge cho duyet', async () => {
    streamChatMock.mockImplementation(
      (
        _request: unknown,
        options: { onEvent?: (event: ChatEvent) => void },
      ) =>
        makeStream(
          [
            metaEvent,
            {
              type: 'tool_approval',
              id: 'call-danger',
              name: 'deleteFile',
              args: { path: '/tmp/a.txt' },
              reason: 'Tool nay xoa du lieu',
            },
            doneEvent,
          ],
          options.onEvent,
        ),
    )

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.send('Xoa file')
    })

    const assistant = useChatStore.getState().messages[1]
    expect(assistant?.toolCalls?.[0]?.approvalRequired).toBe(true)
    expect(assistant?.toolCalls?.[0]?.status).toBe('pending')
    expect(assistant?.toolCalls?.[0]?.name).toBe('deleteFile')
  })
})
