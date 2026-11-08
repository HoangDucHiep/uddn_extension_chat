import { useCallback, useEffect, useRef } from 'react'
import {
  applyContextBudget,
  AUTO_RETRY_BACKOFF_MS,
  classifyChatError,
  CONTEXT_WINDOWS,
  shouldAutoRetry,
  type ChatEvent,
  type ChatOperation,
  type ContextBundle,
  type ImageAttachment,
  type ProviderId,
} from '@sidekick/shared'
import { ChatRequestError, generateRequestId, streamChat } from '@/lib/sseClient'
import {
  attachCurrentTab as attachCurrentTabFromLib,
  attachSelection as attachSelectionFromLib,
  attachTab as attachTabFromLib,
  captureActiveSelection as captureActiveSelectionFromLib,
} from '@/lib/contextAttach'
import { readContextEnabled } from '@/lib/storage'
import { readPreferredProvider } from '@/lib/onboarding'
import { SELECTION_EMPTY_ERROR_CODE, type PendingSelection } from '@/lib/selectionProtocol'
import { activePathMessages, buildHistory } from '@/lib/chatTurns'
import { useChatStore, type ChatImage, type ChatMessage } from '../store/chatStore'
import { useI18n } from './useI18n'

/**
 * Hook `useChat` — dieu khien luong chat: gui prompt, nhan stream, dung.
 *
 * Tu M1-10, them 3 thao tac:
 *  - `regenerate` — sinh lai cau tra loi (FR-CHAT-05).
 *  - `editAndResend` — sua & gui lai tin nhan user (FR-CHAT-06).
 *  - `continueAnswer` — tiep tuc cau tra loi da bi stop (FR-CHAT-07).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.3, §7.11
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
  const { t } = useI18n()
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
  const path = useChatStore((state) => state.path)

  const addMessage = useChatStore((state) => state.addMessage)
  const appendToMessage = useChatStore((state) => state.appendToMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const addCitation = useChatStore((state) => state.addCitation)
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
  const setPath = useChatStore((state) => state.setPath)
  const hydratePath = useChatStore((state) => state.hydratePath)
  const activateVariantLocal = useChatStore((state) => state.activateVariant)
  const setAborted = useChatStore((state) => state.setAborted)
  const setMessageError = useChatStore((state) => state.setMessageError)

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
        message: t('context.notice.selectionEmptyHint'),
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
  }, [attachItem, setContextError, t])

  // Giu AbortController de "Dung" huy stream.
  const abortRef = useRef<AbortController | undefined>(undefined)

  /**
   * Stream 1 luot chat voi 1 `operation` (T-M1-10).
   *
   * Dung chung cho `send` / `regenerate` / `editAndResend` / `continueAnswer`
   * → chi 1 noi duy nhat xu ly SSE.
   *
   * @param operation - Loai thao tac.
   * @param options - Tham so rieng cho tung operation.
   */
  const streamTurn = useCallback(
    async (
      operation: ChatOperation,
      options: {
        /** Noi dung user message (chi dung cho `send` / `branch`). */
        userContent?: string
        /** Id assistant message can thao tac (`regenerate` / `continue`). */
        assistantMessageId?: string
        /** Id turn cha (`branch`). */
        parentTurnId?: string
        /** Id message assistant nhan token (mac dinh: tao message moi). */
        targetMessageId?: string
        /** Lich su gui len provider (mac dinh: suy tu duong di active). */
        history?: Array<{ role: 'user' | 'assistant'; content: string }>
      } = {},
    ) => {
      const state = useChatStore.getState()
      if (state.isStreaming) return

      const userContent = options.userContent?.trim() ?? ''
      const images = operation === 'send' || operation === 'branch' ? state.pendingImages : []

      // Chi phep gui chi anh (khong co text) — vi du user hoi "mo ta anh nay".
      if (operation === 'send' && userContent.length === 0 && images.length === 0) return

      // Lich su TRUOC luot hien tai — snapshot truoc khi them user message.
      // Phai loai message assistant "placeholder" (content rong) va noi dung
      // rong, vi server validate `content` toi thieu 1 ky tu.
      const history =
        options.history ??
        buildHistory(state.messages, state.path).filter(
          (turn) => turn.content.trim().length > 0,
        )

      // Request-id sinh o client → gui header `X-Request-Id` len server →
      // server ghi cung id vao `request_logs` + chuyen tiep cho provider
      // (T-M1-14 — NFR-MAINT-04). Gan vao message de hien thi ngan.
      const requestId = generateRequestId()

      // Tao message assistant o trang thai streaming de hien thi token ngay.
      // `continue` thi ghi vao message da bi stop (append noi dung).
      const isContinue = operation === 'continue'
      const assistantId =
        options.targetMessageId ??
        (isContinue ? (options.assistantMessageId ?? '') : `assistant-${Date.now()}`)

      let userMessageId: string | undefined
      if (operation === 'send' || operation === 'branch') {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userContent,
          createdAt: Date.now(),
          status: 'done',
          ...(images.length > 0 ? { images: images.map(toChatImage) } : {}),
        }
        addMessage(userMessage)
        userMessageId = userMessage.id
      }

      if (!isContinue && options.targetMessageId === undefined) {
        addMessage({
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          status: 'streaming',
          requestId,
        })
      }

      setStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      // Anh da gui o luot nay → xoa khoi tray.
      if (images.length > 0) clearPendingImages()

      // Anh chi gui o luot hien tai (luot truoc da luu trong DB → server tu tai).
      const requestTurns = [
        ...history,
        ...(operation === 'send' || operation === 'branch'
          ? [
              {
                role: 'user' as const,
                content: userContent.length > 0 ? userContent : '(ảnh đính kèm)',
                ...(images.length > 0 ? { attachments: images } : {}),
              },
            ]
          : []),
      ]

      let sawDone = false
      let sawMeta = false
      /** Loi do **server** bao trong SSE (sau khi turn da tao). */
      let streamError:
        | { code: string; message: string; retryable: boolean; retryAfterSeconds?: number }
        | undefined

      // Context chi duoc gui khi user dinh kem item (FR-CONTEXT-07).
      // KHONG tu capture tab active — panel hoat dong nhu LLM thuan neu
      // user khong dinh kem gi.
      const context = buildRequestContext()

      // Provider user chon trong onboarding (FR-UX-02) → gui len server de
      // server DAT DAU provider do trong chuoi fallback (FR-PROVIDER-04).
      // Khong co → server dung fallback chain mac dinh.
      const preferredProvider = await readPreferredProvider()

      const handleEvent = (event: ChatEvent): void => {
        switch (event.type) {
          case 'meta':
            sawMeta = true
            setConversationId(event.conversationId)
            setActive({
              provider: event.provider,
              model: event.model,
              keySource: event.keySource,
            })
            updateMessage(assistantId, {
              provider: event.provider,
              model: event.model,
              // Id server (uuid) → can cho `regenerate` / `continue` /
              // `retryMessage` goi len BFF (client id khong phai uuid).
              serverId: event.messageId,
              // Server xac nhan request-id (nguon su that) → ghi de id client
              // (T-M1-14). Server luon echo id qua header + SSE `meta`.
              ...(event.requestId !== undefined ? { requestId: event.requestId } : {}),
            })
            if (event.turnId !== undefined) {
              // Server xac nhan turn → gan vao message de client dong bo path.
              updateMessage(assistantId, { turnId: event.turnId })
              if (userMessageId !== undefined) {
                updateMessage(userMessageId, { turnId: event.turnId })
              }
            }
            break

          case 'token':
            appendToMessage(assistantId, event.delta)
            break

          case 'citation':
            // Nguon trich dan (FR-CONTEXT-10 — T-M1-08) → gan vao message
            // de chip inline tra ve dung nguon.
            addCitation(assistantId, {
              index: event.index,
              url: event.url,
              title: event.title,
              snippet: event.snippet,
              ...(event.tabId !== undefined ? { tabId: event.tabId } : {}),
            })
            break

          case 'usage':
            updateMessage(assistantId, { tokensIn: event.tokensIn, tokensOut: event.tokensOut })
            break

          case 'error':
            // Luu **ca** thong tin loi (code / retryable / retryAfterSeconds) —
            // `ErrorState` can chon dung hau dong khoi phuc theo nhom loi.
            // FR-CHAT-14 — T-M1-19.
            streamError = {
              code: event.code,
              message: event.message,
              retryable: event.retryable,
              ...(event.retryAfterSeconds !== undefined
                ? { retryAfterSeconds: event.retryAfterSeconds }
                : {}),
            }
            updateMessage(assistantId, {
              status: 'error',
              errorMessage: event.message,
              errorCode: event.code,
              errorRetryable: event.retryable,
              ...(event.retryAfterSeconds !== undefined
                ? { errorRetryAfterSeconds: event.retryAfterSeconds }
                : {}),
            })
            break

          case 'done':
            sawDone = true
            updateMessage(assistantId, {
              status: event.finishReason === 'error' ? 'error' : 'done',
              ...(event.finishReason === 'aborted' ? { aborted: true } : {}),
            })
            break

          default:
            break
        }
      }

      const chatRequest = {
        messages: requestTurns,
        conversationId: useChatStore.getState().conversationId,
        operation,
        ...(options.assistantMessageId !== undefined
          ? { assistantMessageId: options.assistantMessageId }
          : {}),
        ...(options.parentTurnId !== undefined
          ? { parentTurnId: options.parentTurnId }
          : {}),
        ...(context === undefined ? {} : { context }),
        ...(preferredProvider === undefined ? {} : { provider: preferredProvider }),
      }

      /**
       * Chay 1 lan stream. Tra ve loi neu that bai (neu bi huy → `undefined`).
       *
       * @returns Loi duoc phan loai, hoac `undefined` khi stream xong/huy.
       */
      const runOnce = async (): Promise<
        | { code: string; message: string; retryable: boolean; retryAfterSeconds?: number }
        | undefined
      > => {
        sawDone = false
        sawMeta = false
        streamError = undefined
        try {
          for await (const event of streamChat(chatRequest, {
            signal: controller.signal,
            onEvent: handleEvent,
            requestId,
          })) {
            // Event da duoc xu ly trong onEvent.
            void event
          }

          // Stream bi cut dot ngột → coi nhu aborted (rule docs §4.3.5).
          if (!sawDone) {
            updateMessage(assistantId, { status: 'done' })
          }
          return undefined
        } catch (error) {
          const isAbort = error instanceof Error && error.name === 'AbortError'
          if (isAbort) {
            updateMessage(assistantId, { status: 'done', aborted: true })
            return undefined
          }

          const code = error instanceof ChatRequestError ? error.code : 'SERVICE_UNAVAILABLE'
          const message = error instanceof Error ? error.message : String(error)
          const retryable =
            error instanceof ChatRequestError
              ? error.retryable
              : classifyChatError(code) !== 'auth'

          // Loi do server bao trong SSE → uu tien thong tin do (co
          // `retryAfterSeconds` chinh xac cho 429).
          if (streamError !== undefined) {
            return streamError
          }

          updateMessage(assistantId, {
            status: 'error',
            errorMessage: message,
            errorCode: code,
            errorRetryable: retryable,
          })
          return { code, message, retryable }
        }
      }

      try {
        const failure = await runOnce()

        if (failure !== undefined) {
          // Tu dong retry **1 lan** voi backoff 800ms (NFR-REL-02).
          // Chi loi tam thoi (mang / 5xx) — KHONG retry loi auth (key sai)
          // hay rate-limit (phai doi het han).
          const kind = classifyChatError(failure.code)
          const canAutoRetry = shouldAutoRetry(kind) && failure.retryable && !sawMeta
          if (canAutoRetry) {
            await sleep(AUTO_RETRY_BACKOFF_MS)
            const secondFailure = await runOnce()
            if (secondFailure !== undefined) {
              updateMessage(assistantId, {
                status: 'error',
                errorMessage: secondFailure.message,
                errorCode: secondFailure.code,
                errorRetryable: secondFailure.retryable,
                ...(secondFailure.retryAfterSeconds !== undefined
                  ? { errorRetryAfterSeconds: secondFailure.retryAfterSeconds }
                  : {}),
              })
            }
          }
        }
      } finally {
        setStreaming(false)
        abortRef.current = undefined
      }
    },
    [
      addMessage,
      appendToMessage,
      addCitation,
      setActive,
      setConversationId,
      setStreaming,
      updateMessage,
      clearPendingImages,
    ],
  )

  const send = useCallback(
    async (content: string) => {
      await streamTurn('send', { userContent: content })
    },
    [streamTurn],
  )

  /**
   * Sinh lai cau tra loi cua 1 turn (FR-CHAT-05 — T-M1-10).
   *
   * @param assistantMessageId - Id cua assistant message can sinh lai.
   */
  const regenerate = useCallback(
    async (assistantMessageId: string) => {
      const state = useChatStore.getState()
      const target = state.messages.find((message) => message.id === assistantMessageId)
      if (target === undefined) return

      // Server chi nhan `assistantMessageId` la **uuid** → phai dung id server.
      // Client id (`assistant-<timestamp>`) khong phai uuid → server tra 400.
      const serverId = target.serverId
      if (serverId === undefined) return

      // Bien the cu → `active = false`; bien the moi se la active.
      const turnId = target.turnId
      if (turnId !== undefined) {
        state.messages
          .filter((message) => message.turnId === turnId && message.role !== 'user')
          .forEach((message) => {
            updateMessage(message.id, { active: false })
          })
      }

      await streamTurn('regenerate', {
        assistantMessageId: serverId,
        // Lich su = den het turn cua message dang sinh lai.
        history: buildHistory(state.messages, state.path),
      })
    },
    [streamTurn, updateMessage],
  )

  /**
   * Sua & gui lai tin nhan user (FR-CHAT-06 — T-M1-10).
   *
   * @param userMessageId - Id cua user message can sua.
   * @param newContent - Noi dung moi.
   */
  const editAndResend = useCallback(
    async (userMessageId: string, newContent: string) => {
      const trimmed = newContent.trim()
      if (trimmed.length === 0) return

      const state = useChatStore.getState()
      const target = state.messages.find((message) => message.id === userMessageId)
      if (target === undefined) return

      const parentTurnId = target.turnId
      if (parentTurnId === undefined) return

      // Cat duong di tai turn cha → cac turn sau tro thanh nhanh cu.
      const cutIndex = state.path.indexOf(parentTurnId)
      const inactiveTurnIds = cutIndex >= 0 ? state.path.slice(cutIndex) : []
      const nextPath = cutIndex >= 0 ? [...state.path.slice(0, cutIndex)] : [...state.path]

      setPath(nextPath, inactiveTurnIds)

      await streamTurn('branch', {
        userContent: trimmed,
        parentTurnId,
        // Lich su = phan truoc turn cha.
        history: buildHistory(state.messages, nextPath),
      })
    },
    [streamTurn, setPath],
  )

  /**
   * Tiep tuc cau tra loi da bi stop (FR-CHAT-07 — T-M1-10).
   *
   * @param assistantMessageId - Id cua assistant message bi stop.
   */
  const continueAnswer = useCallback(
    async (assistantMessageId: string) => {
      const state = useChatStore.getState()
      const target = state.messages.find((message) => message.id === assistantMessageId)
      if (target === undefined) return

      // Server chi nhan `assistantMessageId` la uuid → dung id server.
      const serverId = target.serverId
      if (serverId === undefined) return

      setAborted(assistantMessageId, false)

      await streamTurn('continue', {
        assistantMessageId: serverId,
        targetMessageId: assistantMessageId,
        // Lich su = het turn hien tai (bao gom phan assistant da ngat).
        history: buildHistory(state.messages, state.path),
      })
    },
    [streamTurn, setAborted],
  )

  /**
   * Thu lai 1 luot chat bi loi (FR-CHAT-14 — T-M1-19).
   *
   * Nut "Thu lai" cua `ErrorState` → goi day. Luot duoc **sinh lai** tu
   * user message (operation `regenerate`) → khong tao them user message.
   *
   * @param assistantMessageId - Id (client) cua assistant message bi loi.
   */
  const retryMessage = useCallback(
    async (assistantMessageId: string) => {
      const state = useChatStore.getState()
      const target = state.messages.find((message) => message.id === assistantMessageId)
      if (target === undefined) return
      // Chi thu lai duoc khi server da tao message (co uuid).
      if (target.serverId === undefined) return

      // Xoa thong tin loi cu → card loi bi loi lai sau khi stream lai.
      setMessageError(assistantMessageId, {
        code: undefined,
        retryable: undefined,
        retryAfterSeconds: undefined,
      })
      updateMessage(assistantMessageId, { status: 'streaming', errorMessage: undefined })

      await streamTurn('regenerate', {
        assistantMessageId: target.serverId,
        targetMessageId: assistantMessageId,
        history: buildHistory(state.messages, state.path),
      })
    },
    [streamTurn, setMessageError, updateMessage],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clear = useCallback(() => {
    useChatStore.getState().reset()
  }, [])

  /**
   * Nap duong di active (T-M1-10).
   *
   * @param nextPath - Duong di moi.
   */
  const setConversationPath = useCallback(
    (nextPath: readonly string[]) => {
      hydratePath(nextPath)
    },
    [hydratePath],
  )

  /**
   * Doi bien the active cua 1 turn (T-M1-10 — FR-CHAT-05).
   *
   * @param turnId - Id turn.
   * @param variantIndex - Chi so bien the moi.
   */
  const activateVariant = useCallback(
    (turnId: string, variantIndex: number) => {
      activateVariantLocal(turnId, variantIndex)
    },
    [activateVariantLocal],
  )

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
    path,
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
    regenerate,
    editAndResend,
    continueAnswer,
    retryMessage,
    setConversationPath,
    activateVariant,
    activePathMessages: useCallback(
      (allMessages: readonly ChatMessage[]) =>
        activePathMessages(allMessages, useChatStore.getState().path),
      [],
    ),
  }
}

/**
 * Cho mot khoang thoi gian (ms).
 *
 * Dung cho backoff giua 2 lan thu lai (NFR-REL-02).
 *
 * @param ms - So mili-giay cho.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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
 * * thuc te nen day chi la lop hien thi + tiet kiem bang thong.
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
