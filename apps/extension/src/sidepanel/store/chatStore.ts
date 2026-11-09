import { create } from 'zustand'
import {
  applyContextBudget,
  CONTEXT_WINDOWS,
  type ContextBudgetResult,
  type ContextItem,
  type ImageAttachment,
  type ProviderId,
} from '@sidekick/shared'
import { writeContextEnabled } from '@/lib/storage'

/**
 * Store cua side panel.
 * State chi nam o side panel + chrome.storage.local + Postgres — KHONG
 * nam trong service worker (MV3 SW bi kill sau ~30s).
 */

/**
 * Provider dung de tinh ngan sach khi chua biet provider thuc te.
 *
 * Context window 128k — dung de *khong* cat nham noi dung client-side;
 * server cat lai theo provider thuc te (nguon chan su that).
 */
const FALLBACK_PROVIDER: ProviderId = 'groq'

export interface ChatImage {
  /** Id anh (uuid) — khop voi `message_attachments.id` tren server. */
  id: string
  mimeType: string
  /** Data URL day du (`data:<mime>;base64,<data>`) — dung cho `<img src>`. */
  dataUrl: string
  bytes: number
  width?: number
  height?: number
  fileName?: string
}

/**
 * Mot nguon trich dan cua message (FR-CONTEXT-10 — T-M1-08).
 *
 * `index` khop voi marker `[N]` trong noi dung message → chip inline tra
 * ve dung nguon nay.
 */
export interface ChatCitation {
  /** So thu tu nguon (1-based). */
  index: number
  url: string
  title: string
  /** Doan trich ngan cua nguon. */
  snippet: string
  /** Tab ID neu nguon den tu tab da dinh kem. */
  tabId?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** Provider/model da sinh message nay (DP-6 — hien thi nguon). */
  provider?: string
  model?: string
  /** Trang thai stream: dang cho, dang stream, da xong, loi. */
  status: 'pending' | 'streaming' | 'done' | 'error'
  errorMessage?: string | undefined
  tokensIn?: number
  tokensOut?: number
  /**
   * Chi phi USD cua luot nay (T-M2-03 — FR-PROVIDER-05).
   *
   * Gia tri uoc luong theo bang gia token (khong phai hoa don) → hien thi
   * khoang 4 chu so nghinh.
   */
  costUsd?: number
  /** Anh dinh kem cua message (FR-VISION-01 — T-M1-24). */
  images?: ChatImage[]
  /** Nguon trich dan cua message (FR-CONTEXT-10 — T-M1-08). */
  citations?: ChatCitation[]
  /**
   * Id cua turn chua message nay (T-M1-10).
   *
   * User message + cac bien the assistant cua cung 1 luot hoi–dap chia
   * chung `turnId`.
   */
  turnId?: string
  /** Chi so bien the assistant trong turn (0-based). */
  variantIndex?: number
  /** Message nam tren duong di active cua conversation. */
  active?: boolean
  /** Id cua turn cha (khi sua & gui lai → tao branch). */
  parentTurnId?: string
  /** Assistant bi stop giua chung → co nut "Tiep tuc" (FR-CHAT-07). */
  aborted?: boolean
  /**
   * Id message **phia server** (uuid) — tu SSE `meta.messageId`.
   *
   * Client sinh id local (`assistant-<timestamp>`) nen khong dung lam
   * `assistantMessageId` cho `regenerate` / `continue` (server tra 404).
   * FR-CHAT-14 — T-M1-19.
   */
  serverId?: string
  /**
   * Error code chuan cua server (FR-CHAT-14 — T-M1-19).
   *
   * Dung de phan loai nhom loi → chon dung hau dong khoi phuc.
   */
  errorCode?: string | undefined
  /** Loi co the thu lai khong (server quyet dinh). */
  errorRetryable?: boolean | undefined
  /** So giay user phai cho truoc khi thu lai (429). */
  errorRetryAfterSeconds?: number | undefined
  /**
   * Request-id cua luot chat (T-M1-14 — NFR-MAINT-04).
   *
   * Dung de doi chieu message tren man hinh voi dong `request_logs` trong DB
   * (hiển thị 6 ky tu dau trong meta line — trust-by-transparency).
   */
  requestId?: string | undefined
}

export interface ChatState {
  messages: ChatMessage[]
  conversationId: string | undefined
  isStreaming: boolean
  /** Provider dang chay (de hien thi chip). */
  activeProvider: string | undefined
  activeModel: string | undefined
  keySource: string | undefined
  /** Error code khi trich xuat context that bai (PDF scan, khong co caption...). */
  contextError: string | undefined
  /** Thong diep chi tiet cua loi trich xuat context. */
  contextErrorMessage: string | undefined
  /** Loai trang da trich xuat context gan nhat. */
  contextSourceKind: string | undefined
  /** Context item user da dinh kem (FR-CONTEXT-07). */
  attachedItems: ContextItem[]
  /** Bat/tat viec gui context — mac dinh TAT (chi gui khi user dinh kem). */
  contextEnabled: boolean
  /** Ket qua tinh ngan sach context (hien thi meter). */
  budget: ContextBudgetResult | undefined
  /**
   * Anh cho san, chua gui (FR-VISION-01 — T-M1-24).
   *
   * KHONG phai context item → khong phu thuoc toggle `contextEnabled`.
   */
  pendingImages: ImageAttachment[]
  /**
   * Duong di active cua conversation (T-M1-10 — FR-CHAT-06).
   *
   * Danh sach `turnId` theo thu tu. Turn khong nam trong day → nhanh cu.
   */
  path: string[]
  /**
   * Ban nhap chua gui (FR-CHAT-13 — T-M1-10).
   *
   * Persist theo `conversationId` trong `chrome.storage.local`.
   */
  draft: string

  addMessage: (message: ChatMessage) => void
  appendToMessage: (id: string, delta: string) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  /**
   * Them 1 nguon trich dan vao message (FR-CONTEXT-10 — T-M1-08).
   *
   * Trung `index` → ghi de (SSE co the lap marker o cac doan khac nhau).
   */
  addCitation: (id: string, citation: ChatCitation) => void
  setConversationId: (conversationId: string | undefined) => void
  /**
   * Nap lai lich su hoi thoai cua 1 conversation (FR-CHAT-09 — T-M1-09).
   *
   * Thay the toan bo `messages` — dung khi user chon conversation khac
   * trong drawer. Citations da luu duoc gan lai vao message tuong ung.
   *
   * @param conversationId - Id conversation dang mo.
   * @param messages - Lich su da lay tu BFF.
   */
  hydrateConversation: (conversationId: string, messages: ChatMessage[]) => void
  setStreaming: (isStreaming: boolean) => void
  setActive: (info: {
    provider?: string | undefined
    model?: string | undefined
    keySource?: string | undefined
  }) => void
  setContextError: (info: {
    error?: string | undefined
    message?: string | undefined
    sourceKind?: string | undefined
  }) => void
  /** Them context item (tu nguon dinh kem: tab / selection / file). */
  attachItem: (item: ContextItem) => void
  /** Xoa context item theo id. */
  removeItem: (id: string) => void
  /** Xoa toan bo context item da dinh kem. */
  clearAttachedItems: () => void
  /** Bat/tat gui context + luu vao `chrome.storage.local`. */
  setContextEnabled: (enabled: boolean) => void
  /** Nap trang thai bat/tat context da luu (goi 1 lan khi mo panel). */
  hydrateContextEnabled: (enabled: boolean) => void
  /** Tinh lai ngan sach context (goi sau khi items/provider doi). */
  recomputeBudget: () => void
  /** Them anh cho san (chua gui). */
  addPendingImages: (images: readonly ImageAttachment[]) => void
  /** Xoa mot anh cho san theo id. */
  removePendingImage: (id: string) => void
  /** Xoa tat ca anh cho san. */
  clearPendingImages: () => void
  /**
   * Nap duong di active + tat ca turn (T-M1-10).
   *
   * @param path - Duong di active (danh sach `turnId`).
   */
  hydratePath: (path: readonly string[]) => void
  /**
   * Thay duong di active (T-M1-10 — khi sua & gui lai cat path).
   *
   * @param path - Duong di moi.
   * @param inactiveTurnIds - Cac turn bi cat khoi path → `active = false`.
   */
  setPath: (path: readonly string[], inactiveTurnIds?: readonly string[]) => void
  /**
   * Doi bien the active cua 1 turn (T-M1-10 — FR-CHAT-05).
   *
   * @param turnId - Id turn.
   * @param variantIndex - Chi so bien the moi.
   */
  activateVariant: (turnId: string, variantIndex: number) => void
  /**
   * Danh dau message bi stop giua chung (FR-CHAT-07 — T-M1-10).
   *
   * @param id - Id message assistant.
   */
  setAborted: (id: string, aborted: boolean) => void
  /**
   * Gan thong tin loi cua message (FR-CHAT-14 — T-M1-19).
   *
   * @param id - Id message assistant.
   * @param error - `{ code, retryable, retryAfterSeconds }` — bo undefined de xoa.
   */
  setMessageError: (
    id: string,
    error: {
      code?: string | undefined
      retryable?: boolean | undefined
      retryAfterSeconds?: number | undefined
    },
  ) => void
  /** Nap ban nhap (FR-CHAT-13 — T-M1-10). */
  setDraft: (draft: string) => void
  reset: () => void
}

const initialState = {
  messages: [] as ChatMessage[],
  conversationId: undefined,
  isStreaming: false,
  activeProvider: undefined,
  activeModel: undefined,
  keySource: undefined,
  contextError: undefined,
  contextErrorMessage: undefined,
  contextSourceKind: undefined,
  attachedItems: [] as ContextItem[],
  contextEnabled: false,
  budget: undefined as ContextBudgetResult | undefined,
  pendingImages: [] as ImageAttachment[],
  path: [] as string[],
  draft: '',
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendToMessage: (id, delta) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, content: message.content + delta } : message,
      ),
    })),

  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    })),

  addCitation: (id, citation) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== id) return message
        const existing = message.citations ?? []
        // Trung theo `index` → citation moi ghi de citation cu cung chi so.
        const merged = existing.filter((item) => item.index !== citation.index)
        merged.push(citation)
        merged.sort((a, b) => a.index - b.index)
        return { ...message, citations: merged }
      }),
    })),

  setConversationId: (conversationId) => set({ conversationId }),

  hydrateConversation: (conversationId, messages) =>
    set({
      conversationId,
      messages,
      isStreaming: false,
      // Duong di moi → path cu cua conversation truoc khong con dung.
      path: [],
      draft: '',
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setActive: ({ provider, model, keySource }) => {
    set({
      activeProvider: provider ?? undefined,
      activeModel: model ?? undefined,
      keySource: keySource ?? undefined,
    })
    get().recomputeBudget()
  },

  setContextError: ({ error, message, sourceKind }) =>
    set({
      contextError: error ?? undefined,
      contextErrorMessage: message ?? undefined,
      contextSourceKind: sourceKind ?? undefined,
    }),

  attachItem: (item) => {
    set((state) => ({
      attachedItems: [...state.attachedItems.filter((existing) => existing.id !== item.id), item],
      // Dinh kem item = user chu dong muon dung context → bat context.
      contextEnabled: true,
    }))
    void writeContextEnabled(true)
    get().recomputeBudget()
  },

  removeItem: (id) => {
    set((state) => ({
      attachedItems: state.attachedItems.filter((item) => item.id !== id),
    }))
    get().recomputeBudget()
  },

  clearAttachedItems: () => {
    set({ attachedItems: [] })
    get().recomputeBudget()
  },

  setContextEnabled: (enabled) => {
    set({ contextEnabled: enabled })
    void writeContextEnabled(enabled)
    get().recomputeBudget()
  },

  hydrateContextEnabled: (enabled) => {
    set({ contextEnabled: enabled })
    get().recomputeBudget()
  },

  recomputeBudget: () => {
    const state = get()
    if (state.attachedItems.length === 0) {
      set({ budget: undefined })
      return
    }

    const provider = (state.activeProvider ?? FALLBACK_PROVIDER) as ProviderId
    const contextWindow = CONTEXT_WINDOWS[provider] ?? CONTEXT_WINDOWS[FALLBACK_PROVIDER]

    set({
      budget: applyContextBudget(state.attachedItems, {
        contextWindow,
        reservedOutputTokens: 2_048,
      }),
    })
  },

  addPendingImages: (images) =>
    set((state) => ({
      // Thay the anh cung id (tranh trung khi user chon lai cung file).
      pendingImages: [
        ...state.pendingImages.filter(
          (existing) => !images.some((image) => image.id === existing.id),
        ),
        ...images,
      ],
    })),

  removePendingImage: (id) =>
    set((state) => ({
      pendingImages: state.pendingImages.filter((image) => image.id !== id),
    })),

  clearPendingImages: () => set({ pendingImages: [] }),

  hydratePath: (path) => set({ path: [...path] }),

  setPath: (path, inactiveTurnIds = []) => {
    const inactive = new Set(inactiveTurnIds)
    set((state) => ({
      path: [...path],
      messages: state.messages.map((message) => {
        if (message.turnId === undefined) return message
        if (inactive.has(message.turnId)) {
          return message.active === false ? message : { ...message, active: false }
        }
        return message
      }),
    }))
  },

  activateVariant: (turnId, variantIndex) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.turnId !== turnId) return message
        if (message.role === 'user') return message
        return {
          ...message,
          active: message.variantIndex === variantIndex,
        }
      }),
    })),

  setAborted: (id, aborted) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, aborted } : message,
      ),
    })),

  setMessageError: (id, error) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== id) return message
        const { code, retryable, retryAfterSeconds } = error
        // Gan **ca 3** truong (ke ca `undefined`) → goi voi `undefined` de
        // xoa thong tin loi cu (dung khi thu lai luot bi loi).
        return {
          ...message,
          errorCode: code,
          errorRetryable: retryable,
          errorRetryAfterSeconds: retryAfterSeconds,
        }
      }),
    })),

  setDraft: (draft) => set({ draft }),

  reset: () =>
    set((state) => ({
      ...initialState,
      // Giu nguyen context da dinh kem + trang thai bat/tat (clear khong xoa
      // nguon context cua user).
      attachedItems: state.attachedItems,
      contextEnabled: state.contextEnabled,
      budget: state.budget,
      // Anh cho san thuoc ve luot gui hien tai → xoa khi clear.
      pendingImages: [],
      // Draft thuoc ve luot gui hien tai → xoa khi clear.
      draft: '',
    })),
}))
