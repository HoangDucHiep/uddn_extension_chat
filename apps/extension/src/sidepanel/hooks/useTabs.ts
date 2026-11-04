import { useCallback, useEffect, useState } from 'react'
import { listOpenTabs, type OpenTab } from '@/lib/tabList'

/**
 * Hook `useTabs` — quan ly danh sach tab cho popover `@` (T-M1-05).
 *
 * Chi nap danh sach khi popover mo (lazy) → khong phai query tabs lien tuc.
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3
 */
export interface UseTabsResult {
  /** Danh sach tab (da loc trang dac biet). */
  tabs: OpenTab[]
  /** Dang tai danh sach. */
  isLoading: boolean
  /** Nap lai danh sach (goi khi popover mo lai). */
  reload: () => Promise<void>
}

/**
 * @param enabled - Khi `false`, hook khong nap danh sach (popover dong).
 */
export function useTabs(enabled: boolean): UseTabsResult {
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const reload = useCallback(async () => {
    setIsLoading(true)
    try {
      const next = await listOpenTabs()
      setTabs(next)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void reload()
  }, [enabled, reload])

  return { tabs, isLoading, reload }
}
