/**
 * Doc trang dang active cua cua so hien tai (T-M1-11).
 *
 * Dung cho `PromptGallery` — can biet URL + tieu de de phan loai trang va
 * dien placeholder `{title}` vao goi y.
 *
 * Nguyen tac: **khong bao gio throw** — loi tra ve `undefined` de panel van
 * chat duoc (chi mat goi y theo trang).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.12
 */

/** Thong tin trang dang active. */
export interface ActivePage {
  /** URL day du cua trang. */
  url: string
  /** Tieu de trang (co the rong). */
  title: string
}

/**
 * Doc tab active trong cua so hien tai.
 *
 * @returns Thong tin trang active, hoac `undefined` neu khong doc duoc.
 */
export async function readActivePage(): Promise<ActivePage | undefined> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tab = tabs.find((item) => item.active === true) ?? tabs[0]
    if (tab === undefined) return undefined
    const url = tab.url ?? ''
    if (url.length === 0) return undefined
    return { url, title: tab.title?.trim() ?? '' }
  } catch {
    // Khong truy cap duoc tab → khong co goi y theo trang.
    return undefined
  }
}
