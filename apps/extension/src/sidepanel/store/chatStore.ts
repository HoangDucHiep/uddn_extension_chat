import { create } from 'zustand'

/**
 * Store cua side panel.
 * State chi nam o side panel + chrome.storage.local + Postgres — KHONG
 * nam trong service worker (MV3 SW bi kill sau ~30s).
 */

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
}

export const useChatStore = create<ChatState>((set) => ({
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

  setActive: ({ provider, model, keySource }) =>
    set({
      activeProvider: provider ?? undefined,
      activeModel: model ?? undefined,
      keySource: keySource ?? undefined,
    }),

  setContextError: ({ error, message, sourceKind }) =>
    set({
      contextError: error ?? undefined,
      contextErrorMessage: message ?? undefined,
      contextSourceKind: sourceKind ?? undefined,
    }),

  reset: () => set({ ...initialState }),
}))
