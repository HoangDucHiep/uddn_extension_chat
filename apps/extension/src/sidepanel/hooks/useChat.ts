import { useCallback, useRef } from 'react'
import type { ChatEvent, PageContext } from '@sidekick/shared'
import { streamChat } from '@/lib/sseClient'
import { captureTabContext, getActiveTabId } from '@/lib/pageContext'
import { useChatStore, type ChatMessage } from '../store/chatStore'

/**
 * Hook `useChat` — dieu khien luong chat: gui prompt, nhan stream, dung.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.3
 */
export function useChat() {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const conversationId = useChatStore((state) => state.conversationId)
  const activeProvider = useChatStore((state) => state.activeProvider)
  const activeModel = useChatStore((state) => state.activeModel)
  const keySource = useChatStore((state) => state.keySource)

  const addMessage = useChatStore((state) => state.addMessage)
  const appendToMessage = useChatStore((state) => state.appendToMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const setConversationId = useChatStore((state) => state.setConversationId)
  const setStreaming = useChatStore((state) => state.setStreaming)
  const setActive = useChatStore((state) => state.setActive)

  // Giu AbortController de "Dung" huy stream.
  const abortRef = useRef<AbortController | undefined>(undefined)

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (trimmed.length === 0 || useChatStore.getState().isStreaming) return

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        status: 'done',
      }
      addMessage(userMessage)

      // Tao message assistant o trang thai streaming de hien thi token ngay.
      const assistantId = `assistant-${Date.now()}`
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        status: 'streaming',
      })

      setStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      // Lich su gui len BFF — chi gui role/content, khong gui metadata noi bo.
      // Phai loai message assistant "placeholder" (content rong) va noi dung rong,
      // vi server validate `content` toi thieu 1 ky tu.
      const history = useChatStore
        .getState()
        .messages.filter(
          (message) =>
            message.role !== 'system' && message.content.trim().length > 0,
        )
        .map((message) => ({
          role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: message.content,
        }))

      let sawDone = false

      // Lay context trang hien tai (FR-CONTEXT-01).
      // KHONG de loi lam chat that bai — context la thong tin bonus.
      const context = await captureActiveContext()

      const handleEvent = (event: ChatEvent): void => {
        switch (event.type) {
          case 'meta':
            setConversationId(event.conversationId)
            setActive({
              provider: event.provider,
              model: event.model,
              keySource: event.keySource,
            })
            updateMessage(assistantId, { provider: event.provider, model: event.model })
            break

          case 'token':
            appendToMessage(assistantId, event.delta)
            break

          case 'usage':
            updateMessage(assistantId, { tokensIn: event.tokensIn, tokensOut: event.tokensOut })
            break

          case 'error':
            updateMessage(assistantId, {
              status: 'error',
              errorMessage: event.message,
            })
            break

          case 'done':
            sawDone = true
            updateMessage(assistantId, {
              status: event.finishReason === 'error' ? 'error' : 'done',
            })
            break

          default:
            break
        }
      }

      try {
        for await (const event of streamChat(
          {
            messages: history,
            conversationId: useChatStore.getState().conversationId,
            ...(context === undefined ? {} : { context }),
          },
          { signal: controller.signal, onEvent: handleEvent },
        )) {
          // Event da duoc xu ly trong onEvent.
          void event
        }

        // Stream bi cut dot ngột → coi nhu aborted (rule docs §4.3.5).
        if (!sawDone) {
          updateMessage(assistantId, { status: 'done' })
        }
      } catch (error) {
        const isAbort = error instanceof Error && error.name === 'AbortError'
        updateMessage(assistantId, {
          status: isAbort ? 'done' : 'error',
          ...(isAbort ? {} : { errorMessage: error instanceof Error ? error.message : String(error) }),
        })
      } finally {
        setStreaming(false)
        abortRef.current = undefined
      }
    },
    [addMessage, appendToMessage, setActive, setConversationId, setStreaming, updateMessage],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    useChatStore.getState().reset()
  }, [])

  return {
    messages,
    isStreaming,
    conversationId,
    activeProvider,
    activeModel,
    keySource,
    send,
    stop,
    clear,
  }
}

/**
 * Capture context cua tab dang active.
 *
 * Tra `undefined` khi khong lay duoc (khong co tab, trang khong doc duoc)
 * de request van gui len BFF binh thuong — context chi la du lieu bonus.
 */
async function captureActiveContext(): Promise<PageContext | undefined> {
  try {
    const tabId = await getActiveTabId()
    if (tabId === undefined) return undefined

    const context = await captureTabContext(tabId)
    // Trang rong (khong co url/title/text) → bo qua, khong gui context rong.
    if (context.url.length === 0 && context.title.length === 0) return undefined

    return context
  } catch {
    return undefined
  }
}
