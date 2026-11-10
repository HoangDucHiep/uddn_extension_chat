import { useCallback, useEffect } from 'react'
import { fetchBudgetStatus } from '@/lib/budgetClient'
import { useBudgetStore } from '@/sidepanel/store/budgetStore'

/**
 * Hook `useBudgetStatus` — nap trang thai budget cap tu BFF.
 *
 * - Nap 1 lan khi panel mount (`GET /api/budget`).
 * - `refresh()` cho phep nap lai (vd sau khi luu trong Settings).
 *
 * Loi nap → **khong** crash panel: bo qua, banner khong hien.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */
export function useBudgetStatus(): { refresh: () => Promise<void> } {
  const setStatus = useBudgetStore((state) => state.setStatus)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const status = await fetchBudgetStatus()
      setStatus(status)
    } catch {
      // BFF khong phat duoc → giu trang thai cu (khong loi chan giao dien).
    }
  }, [setStatus])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { refresh }
}
