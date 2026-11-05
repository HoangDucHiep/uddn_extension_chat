import { useCallback, useEffect, useRef } from 'react'
import {
  applyContextBudget,
  CONTEXT_WINDOWS,
  type ChatEvent,
  type ContextBundle,
  type ImageAttachment,
  type ProviderId,
} from '@sidekick/shared'
import { streamChat } from '@/lib/sseClient'
import {
  attachCurrentTab as attachCurrentTabFromLib,
  attachSelection as attachSelectionFromLib,
  attachTab as attachTabFromLib,
  captureActiveSelection as captureActiveSelectionFromLib,
} from '@/lib/contextAttach'
import { readContextEnabled } from '@/lib/storage'
import { SELECTION_EMPTY_ERROR_CODE, type PendingSelection } from '@/lib/selectionProtocol'
import { useChatStore, type ChatImage, type ChatMessage } from '../store/chatStore'

/**
 * Hook `useChat` — dieu khien luong chat: gui prompt, nhan stream, dung.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.3
 */

/**
 * Provider dung de tinh ngan sach khi chua biet provider thuc te.
 *
 * Context window 128k → client chi cat khi context that lon; server cat lai
 * theo provider thuc te truoc khi goi LLM (nguon chan su that).
 */
const FALLBACK_PROVIDER: ProviderId = 'groq'

/** Token danh rieng cho output (khop voi `DEFAULT_MAX_OUTPUT_TOKENS` cua server). */
const RESERVED_OUTPUT_TOKENS = 2_048

export function useChat() {
  const messages = useChatStore((state) => state.messages)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const conversationId = useChatStore((state) => state.conversationId)
  const activeProvider = useChatStore((state) => state.activeProvider)
  const activeModel = useChatStore((state) => state.activeModel)
  const keySource = useChatStore((state) => state.keySource)
  const contextError = useChatStore((state) => state.contextError)
  const contextErrorMessage = useChatStore((state) => state.contextErrorMessage)
  const attachedItems = useChatStore((state) => state.attachedItems)
  const contextEnabled = useChatStore((state) => state.contextEnabled)
  const budget = useChatStore((state) => state.budget)
  const pendingImages = useChatStore((state) => state.pendingImages)

  const addMessage = useChatStore((state) => state.addMessage)
  const appendToMessage = useChatStore((state) => state.appendToMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const setConversationId = useChatStore((state) => state.setConversationId)
  const setStreaming = useChatStore((state) => state.setStreaming)
  const setActive = useChatStore((state) => state.setActive)
  const setContextError = useChatStore((state) => state.setContextError)
  const attachItem = useChatStore((state) => state.attachItem)
  const removeItem = useChatStore((state) => state.removeItem)
  const clearAttachedItems = useChatStore((state) => state.clearAttachedItems)
  const setContextEnabled = useChatStore((state) => state.setContextEnabled)
  const hydrateContextEnabled = useChatStore((state) => state.hydrateContextEnabled)
  const clearPendingImages = useChatStore((state) => state.clearPendingImages)

  // Nap trang thai bat/tat context da luu trong `chrome.storage.local`.
  // Chi ap dung khi user chua dinh kem gi → khong ghi de lua chon cua user.
  useEffect(() => {
    let cancelled = false
    void readContextEnabled().then((enabled) => {
      if (cancelled) return
      const state = useChatStore.getState()
      if (state.attachedItems.length > 0) return
      hydrateContextEnabled(enabled)
    })
    return () => {
      cancelled = true
    }
  }, [hydrateContextEnabled])

  // Dinh kem tab dang active vao context (chi khi user bam nut).
  // Tab da dinh kem roi → khong capture lai (tiet kiem + tranh trung).
  const attachCurrentTab = useCallback(async () => {
    const state = useChatStore.getState()
    const result = await attachCurrentTabFromLib(state.attachedItems)
    setContextError({
      error: result.error,
      message: result.errorMessage,
      sourceKind: result.sourceKind,
    })
    if (result.item !== undefined) {
      attachItem(result.item)
    }
    return result.item
  }, [attachItem, setContextError])

  // Dinh kem mot tab bat ky vao context (dung cho `@` mention — T-M1-05).
  // Tab da dinh kem roi → khong capture lai (tiet kiem + tranh trung).
  const attachTab = useCallback(
    async (tabId: number) => {
      const state = useChatStore.getState()
      const result = await attachTabFromLib(tabId, state.attachedItems)
      setContextError({
        error: result.error,
        message: result.errorMessage,
        sourceKind: result.sourceKind,
      })
      if (result.item !== undefined) {
        attachItem(result.item)
      }
      return result.item
    },
    [attachItem, setContextError],
  )

  /**
   * Dinh kem doan text user boi den (duong A — nut nobi tren trang).
   *
   * Doan chon co `tier: 'selection'` → tier cao nhat khi cat bot.
   *
   * @param selection - Doan chon do content script gui len.
   */
  const attachSelection = useCallback(
    async (selection: PendingSelection) => {
      const result = attachSelectionFromLib(selection)
      setContextError({
        error: result.error,
        message: result.errorMessage,
      })
      if (result.item !== undefined) {
        attachItem(result.item)
      }
      return result.item
    },
    [attachItem, setContextError],
  )

  /**
   * Dinh kem doan text user **dang boi** tren tab active (duong B — nut
   * "Dinh doan da chon" trong panel).
   */
  const attachActiveSelection = useCallback(async () => {
    const selection = await captureActiveSelectionFromLib()
    if (selection === undefined) {
      setContextError({
        error: SELECTION_EMPTY_ERROR_CODE,
        message: 'Hãy bôi đen một đoạn văn bản trên trang trước khi dính.',
      })
      return undefined
    }

    const result = attachSelectionFromLib(selection)
    setContextError({
      error: result.error,
      message: result.errorMessage,
    })
    if (result.item !== undefined) {
      attachItem(result.item)
    }
    return result.item
  }, [attachItem, setContextError])

  // Giu AbortController de "Dung" huy stream.
  const abortRef = useRef<AbortController | undefined>(undefined)
  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      const state = useChatStore.getState()
      const images = state.pendingImages

      // Cho phep gui chi anh (khong co text) — vi du user hoi "mo ta anh nay".
      if (trimmed.length === 0 && images.length === 0) return
      if (state.isStreaming) return

      // Lich su TRUOC luot hien tai — snapshot truoc khi them user message.
      // Phai loai message assistant "placeholder" (content rong) va noi dung
      // rong, vi server validate `content` toi thieu 1 ky tu.
      const history = state.messages
        .filter(
          (message) =>
            message.role !== 'system' && message.content.trim().length > 0,
        )
        .map((message) => ({
          role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: message.content,
        }))

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
        status: 'done',
        ...(images.length > 0 ? { images: images.map(toChatImage) } : {}),
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

      // Anh da gui o luot nay → xoa khoi tray.
      clearPendingImages()

      // Anh chi gui o luot hien tai (luot truoc da luu trong DB → server tu tai).
      const requestTurns = [
        ...history,
        {
          role: 'user' as const,
          content: trimmed.length > 0 ? trimmed : '(ảnh đính kèm)',
          ...(images.length > 0 ? { attachments: images } : {}),
        },
      ]

      let sawDone = false

      // Context chi duoc gui khi user dinh kem item (FR-CONTEXT-07).
      // KHONG tu capture tab active — panel hoat dong nhu LLM thuan neu
      // user khong dinh kem gi.
      const context = buildRequestContext()
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
            messages: requestTurns,
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
    [
      addMessage,
      appendToMessage,
      setActive,
      setConversationId,
      setStreaming,
      updateMessage,
      clearPendingImages,
    ],
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
    contextError,
    contextErrorMessage,
    attachedItems,
    contextEnabled,
    budget,
    pendingImages,
    attachCurrentTab,
    attachTab,
    attachSelection,
    attachActiveSelection,
    removeItem,
    clearAttachedItems,
    setContextEnabled,
    send,
    stop,
    clear,
  }
}

/**
 * Chuyen `ImageAttachment` (contract) sang `ChatImage` (state UI).
 *
 * @param attachment - Anh tu contract shared.
 */
function toChatImage(attachment: ImageAttachment): ChatImage {
  return {
    id: attachment.id,
    mimeType: attachment.mimeType,
    dataUrl: `data:${attachment.mimeType};base64,${attachment.data}`,
    bytes: attachment.bytes,
    ...(attachment.width !== undefined ? { width: attachment.width } : {}),
    ...(attachment.height !== undefined ? { height: attachment.height } : {}),
    ...(attachment.fileName !== undefined ? { fileName: attachment.fileName } : {}),
  }
}

/**
 * Xay dung `context` cho request.
 *
 * - `contextEnabled === false` → khong gui `context` (chat thuan LLM).
 * - Khong co item nao → khong gui `context`.
 * - Nguoc lai → ap dung ngan sach context roi gui `context.items`.
 *
 * Client cat theo context window *uoc luong*; server cat lai theo provider
 * thuc te nen day chi la lop hien thi + tiet kiem bang thong.
 */
function buildRequestContext(): ContextBundle | undefined {
  const state = useChatStore.getState()
  if (!state.contextEnabled) return undefined
  if (state.attachedItems.length === 0) return undefined

  const provider = (state.activeProvider ?? FALLBACK_PROVIDER) as ProviderId
  const contextWindow = CONTEXT_WINDOWS[provider] ?? CONTEXT_WINDOWS[FALLBACK_PROVIDER]

  const budget = applyContextBudget(state.attachedItems, {
    contextWindow,
    reservedOutputTokens: RESERVED_OUTPUT_TOKENS,
  })

  useChatStore.getState().recomputeBudget()

  if (budget.items.length === 0) return undefined

  return { items: budget.items }
}
