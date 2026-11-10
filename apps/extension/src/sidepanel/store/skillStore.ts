import { create } from 'zustand'
import type { CreateSkillInput, Skill, UpdateSkillInput } from '@sidekick/shared'
import {
  createSkill as createSkillApi,
  deleteSkill as deleteSkillApi,
  listSkills,
  updateSkill as updateSkillApi,
} from '@/lib/skillClient'

/**
 * Store danh sach skill (FR-SKILL-01/02/03 — T-M2-04).
 *
 * State chi nam o side panel — KHONG nam trong service worker (MV3 SW bi
 * kill sau ~30s).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

export interface SkillState {
  /** Danh sach skill (built-in truoc, sau do skill cua user). */
  items: Skill[]
  /** Dang tai danh sach. */
  isLoading: boolean
  /** Thong diep loi gan nhat (null = khong loi). */
  error: string | undefined

  /** Nap danh sach tu BFF. */
  refresh: () => Promise<void>
  /** Tao skill moi → tra ve skill da tao. */
  create: (input: CreateSkillInput) => Promise<Skill>
  /** Cap nhat skill (optimistic + rollback). */
  update: (id: string, patch: UpdateSkillInput) => Promise<Skill>
  /** Xoa skill. */
  remove: (id: string) => Promise<void>
  /** Nhan ban skill (them `-copy` vao ten). */
  duplicate: (id: string) => Promise<Skill>
  /** Xoa loi. */
  clearError: () => void
}

const initialState = {
  items: [] as Skill[],
  isLoading: false,
  error: undefined as string | undefined,
}

export const useSkillStore = create<SkillState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    set({ isLoading: true, error: undefined })
    try {
      const items = await listSkills()
      set({ items, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  },

  create: async (input) => {
    const created = await createSkillApi(input)
    set((state) => ({ items: [...state.items, created], error: undefined }))
    return created
  },

  update: async (id, patch) => {
    const previous = get().items
    // Optimistic → UI phan hoi ngay. Chi ghi cac field **co** trong patch
    // (giu nguyen field khac) → khong du type `undefined` vao `Skill`.
    set({
      items: previous.map((item) => {
        if (item.id !== id) return item
        const next: Skill = { ...item }
        if (patch.name !== undefined) next.name = patch.name
        if (patch.description !== undefined) next.description = patch.description
        if (patch.promptTemplate !== undefined) next.promptTemplate = patch.promptTemplate
        if (patch.enabled !== undefined) next.enabled = patch.enabled
        if (patch.tags !== undefined) next.tags = patch.tags
        if (patch.model !== undefined) {
          if (patch.model === null) {
            delete next.model
          } else {
            next.model = patch.model
          }
        }
        return next
      }),
      error: undefined,
    })
    try {
      const updated = await updateSkillApi(id, patch)
      set((state) => ({
        items: state.items.map((item) => (item.id === id ? updated : item)),
      }))
      return updated
    } catch (error) {
      // Rollback khi API that bai.
      set({
        items: previous,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  remove: async (id) => {
    const previous = get().items
    set({ items: previous.filter((item) => item.id !== id), error: undefined })
    try {
      await deleteSkillApi(id)
    } catch (error) {
      set({
        items: previous,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },

  duplicate: async (id) => {
    const source = get().items.find((item) => item.id === id)
    if (source === undefined) {
      throw new Error('Khong tim thay skill de nhan ban')
    }

    const created = await createSkillApi({
      name: `${source.name}-copy`,
      description: source.description,
      promptTemplate: source.promptTemplate,
      tags: source.tags,
      ...(source.model !== undefined ? { model: source.model } : {}),
    })
    set((state) => ({ items: [...state.items, created], error: undefined }))
    return created
  },

  clearError: () => set({ error: undefined }),
}))
