import { create } from 'zustand'
import type { ConversationSummary } from '@sidekick/shared'
import {
  createConversation as createConversationApi,
  deleteConversation as deleteConversationApi,
  listConversations,
  updateConversation as updateConversationApi,
} from '@/lib/conversationClient'

/**
 * Store danh sach cuoc tro chuyen (FR-CHAT-08/09/11 — T-M1-09).
 *
 * State chi nam o side panel — KHONG nam trong service worker (MV3 SW bi
 * kill sau ~30s).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

export interface ConversationState {
  /** Danh sach conversation (da loc theo `query` + `archivedView`). */
  items: ConversationSummary[]
  /** Dang tai danh sach. */
  isLoading: boolean
  /** Thong diep loi gan nhat (null = khong loi). */
  error: string | undefined
  /** Chuoi tim kiem theo ten. */
  query: string
  /** `true` → dang xem conversation da luu tru. */
  archivedView: boolean
  /** Con trang cho phan trang them. */
  nextCursor: string | undefined
  /** Id conversation dang hoat dong. */
  activeConversationId: string | undefined
  /** Tieu de conversation dang hoat dong (header). */
  activeTitle: string | undefined

  /** Nap danh sach tu BFF. */
  refresh: () => Promise<void>
  /** Nap them trang tiep theo (keyset pagination). */
  loadMore: () => Promise<void>
  /** Dat chuoi tim kiem (debounce do component lo). */
  setQuery: (query: string) => void
  /** Chuyen giua danh sach dang hoat dong / da luu tru. */
  setArchivedView: (archived: boolean) => void
  /** Dat conversation dang hoat dong. */
  setActiveConversationId: (id: string | undefined, title?: string | undefined) => void
  /** Tao conversation moi → tra ve ban ghi da tao. */
  create: (title?: string) => Promise<ConversationSummary>
  /** Doi ten conversation. */
  rename: (id: string, title: string) => Promise<void>
  /** Bat/tat ghim. */
  togglePin: (id: string) => Promise<void>
  /** Bat/tat luu tru. */
  toggleArchive: (id: string) => Promise<void>
  /** Xoa conversation. */
  remove: (id: string) => Promise<void>
  /** Xoa loi. */
  clearError: () => void
}

const initialState = {
  items: [] as ConversationSummary[],
  isLoading: false,
  error: undefined as string | undefined,
  query: '',
  archivedView: false,
  nextCursor: undefined as string | undefined,
  activeConversationId: undefined as string | undefined,
  activeTitle: undefined as string | undefined,
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    const { query, archivedView } = get()
    set({ isLoading: true, error: undefined })
    try {
      const response = await listConversations({
        q: query.length > 0 ? query : undefined,
        archived: archivedView,
      })
      set({
        items: response.items,
        nextCursor: response.nextCursor,
        isLoading: false,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  loadMore: async () => {
    const { nextCursor, query, archivedView, items } = get()
    if (nextCursor === undefined) return

    set({ isLoading: true, error: undefined })
    try {
      const response = await listConversations({
        q: query.length > 0 ? query : undefined,
        archived: archivedView,
        cursor: nextCursor,
      })
      set({
        // Ghep them — tranh trung id (server da lo trung khi phan trang).
        items: [...items, ...response.items.filter((item) => !items.some((old) => old.id === item.id))],
        nextCursor: response.nextCursor,
        isLoading: false,
      })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  setQuery: (query) => set({ query }),

  setArchivedView: (archivedView) => set({ archivedView }),

  setActiveConversationId: (activeConversationId, title) =>
    set({ activeConversationId, activeTitle: title }),

  create: async (title) => {
    const created = await createConversationApi(title)
    // Chat moi duoc them vao dau danh sach (danh sach sap xep theo
    // `updated_at desc` → conversation vua tao luon o tren).
    set((state) => ({
      items: [created, ...state.items],
      activeConversationId: created.id,
      activeTitle: created.title,
    }))
    return created
  },

  rename: async (id, title) => {
    const previous = get().items
    // Optimistic → UI phan hoi ngay (AC "thao tac CRUD phan anh trong UI ngay").
    set({
      items: previous.map((item) => (item.id === id ? { ...item, title } : item)),
      error: undefined,
    })
    try {
      const updated = await updateConversationApi(id, { title })
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
      }))
    } catch (error) {
      // Rollback khi API that bai.
      set({
        items: previous,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  togglePin: async (id) => {
    const current = get().items.find((item) => item.id === id)
    if (current === undefined) return

    const nextPinned = !current.pinned
    // Optimistic → UI phan hoi ngay (AC "thao tac CRUD phan anh trong UI ngay").
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, pinned: nextPinned } : item,
      ),
      error: undefined,
    }))

    try {
      const updated = await updateConversationApi(id, { pinned: nextPinned })
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
      }))
    } catch (error) {
      // Rollback khi API that bai.
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, pinned: current.pinned } : item,
        ),
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
  },

  toggleArchive: async (id) => {
    const current = get().items.find((item) => item.id === id)
    if (current === undefined) return

    const nextArchived = !current.archived
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, archived: nextArchived } : item,
      ),
      error: undefined,
    }))

    try {
      const updated = await updateConversationApi(id, { archived: nextArchived })
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
      }))
    } catch (error) {
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, archived: current.archived } : item,
        ),
        error: error instanceof Error ? error.message : String(error),
      }))
      throw error
    }
  },

  remove: async (id) => {
    const previous = get().items
    set({ items: previous.filter((item) => item.id !== id), error: undefined })

    try {
      await deleteConversationApi(id)
      set((state) => ({
        activeConversationId:
          state.activeConversationId === id ? undefined : state.activeConversationId,
        activeTitle: state.activeConversationId === id ? undefined : state.activeTitle,
      }))
    } catch (error) {
      set({
        items: previous,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  clearError: () => set({ error: undefined }),
}))
