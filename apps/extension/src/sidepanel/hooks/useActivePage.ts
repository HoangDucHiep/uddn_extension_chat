import { useCallback, useEffect, useState } from 'react'
import { readActivePage, type ActivePage } from '@/lib/activePage'

/**
 * Hook `useActivePage` — theo doi trang dang active (T-M1-11).
 *
 * dung de `PromptGallery` doi bo goi y khi user chuyen tab (FR-UX-03) va de
 * dien ten trang vao placeholder `{title}`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.12
 */
export interface UseActivePageResult {
  /** Thong tin trang dang active — `undefined` khi khong doc duoc. */
  page: ActivePage | undefined
  /** Nap lai thong tin trang (dung sau khi attach context). */
  refresh: () => Promise<void>
}

/**
 * Hook theo doi trang dang active cua cua so hien tai.
 *
 * Listener `chrome.tabs.onActivated` + `chrome.tabs.onUpdated` → khi user doi
 * tab hoac trang tai len → nap lai thong tin trang.
 */
export function useActivePage(): UseActivePageResult {
  const [page, setPage] = useState<ActivePage | undefined>(undefined)

  const refresh = useCallback(async () => {
    const next = await readActivePage()
    setPage(next)
  }, [])

  useEffect(() => {
    void refresh()

    const onActivated = (): void => {
      void refresh()
    }

    const onUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
    ): void => {
      // Chi cap nhat khi URL doi (trang tai lai khong doi trang).
      if (changeInfo.url === undefined) return
      void refresh()
    }

    try {
      chrome.tabs.onActivated.addListener(onActivated)
      chrome.tabs.onUpdated.addListener(onUpdated)
    } catch {
      // Khong co quyen `tabs` → bo qua, gallery dung goi y chung.
    }

    return () => {
      try {
        chrome.tabs.onActivated.removeListener(onActivated)
        chrome.tabs.onUpdated.removeListener(onUpdated)
      } catch {
        // Im lang — listener chua duoc dang ky.
      }
    }
  }, [refresh])

  return { page, refresh }
}
