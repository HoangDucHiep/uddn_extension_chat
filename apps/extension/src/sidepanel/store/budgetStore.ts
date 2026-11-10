import { create } from 'zustand'
import type { BudgetStatus } from '@sidekick/shared'

/**
 * Store trang thai **budget cap** (T-M2-03b — FR-PROVIDER-06).
 *
 * KHAC voi `chatStore.budget` (doan context cua user) → store rieng, ten
 * `budgetStore`, khong trung ten de tranh nham.
 *
 * State nam o side panel (khong phai service worker — MV3 SW bi kill ~30s).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */
export interface BudgetState {
  /** Trang thai budget gan nhat (undefined = chua nap). */
  status: BudgetStatus | undefined
  /** Dat trang thai budget moi. */
  setStatus: (status: BudgetStatus | undefined) => void
}

export const useBudgetStore = create<BudgetState>((set) => ({
  status: undefined,
  setStatus: (status) => {
    set({ status })
  },
}))
