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
  errorMessage?: string
  tokensIn?: number
  tokensOut?: number
  /** Anh dinh kem cua message (FR-VISION-01 — T-M1-24). */
  images?: ChatImage[]
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

  addMessage: (message: ChatMessage) => void
  appendToMessage: (id: string, delta: string) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  setConversationId: (conversationId: string | undefined) => void
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

  setConversationId: (conversationId) => set({ conversationId }),

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
    })),
}))
