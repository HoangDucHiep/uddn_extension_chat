/**
 * Liệt kê các tab đang mở — phục vụ `@` mention (T-M1-05, FR-CONTEXT-03).
 *
 * Nguyên tắc:
 *  - KHÔNG bao giờ throw → lỗi trả về `[]` (panel vẫn chat được).
 *  - Chỉ liệt kê tab **trong cửa sổ hiện tại** → không lộ tab của cửa sổ khác
 *    (side panel thuộc cửa sổ hiện tại).
 *  - Lọc bỏ trang nội bộ của trình duyệt (`chrome://`, `file://`, ...) vì
 *    không đọc được nội dung.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3 (FR-CONTEXT-03)
 */

import { detectPageKind } from '@sidekick/shared'

/** Một tab có thể đính kèm vào context. */
export interface OpenTab {
  /** Id tab trong Chrome. */
  id: number
  /** Tiêu đề tab (có thể rỗng nếu trang chưa tải xong). */
  title: string
  /** URL đầy đủ. */
  url: string
  /** Domain rút gọn để hiển thị. */
  domain: string
  /** Favicon — có thể `undefined` nếu trang không có. */
  favIconUrl: string | undefined
  /** Tab đang active trong cửa sổ hiện tại. */
  active: boolean
}

/**
 * Lấy danh sách tab đang mở, sẵn sàng hiển thị trong popover `@`.
 *
 * @param limit - Số tab tối đa trả về (mặc định 50) để UX không ngợp.
 */
export async function listOpenTabs(limit = 50): Promise<OpenTab[]> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true })

    const result: OpenTab[] = []
    for (const tab of tabs) {
      if (tab.id === undefined) continue

      const url = tab.url ?? ''
      if (url.length === 0) continue

      // Trang dac biet (`chrome://`, `file://`, Web Store) → khong doc duoc.
      if (detectPageKind(url) === 'unknown') continue

      result.push({
        id: tab.id,
        title: tab.title?.trim() || url,
        url,
        domain: domainOf(url),
        favIconUrl: tab.favIconUrl,
        active: tab.active === true,
      })

      if (result.length >= limit) break
    }

    return result
  } catch {
    // Khong truy cap duoc danh sach tab → popover hien thi rong.
    return []
  }
}

/**
 * Đếm tổng số tab đọc được trong cửa sổ hiện tại.
 *
 * Dùng để hiển thị chỉ báo "còn N tab khác" khi danh sách bị cắt bởi
 * `limit` (T-M3-POLISH — không âm thầm bỏ tab).
 *
 * @returns Số tab đọc được, hoặc 0 nếu không truy cập được.
 */
export async function countOpenTabs(): Promise<number> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    let count = 0
    for (const tab of tabs) {
      if (tab.id === undefined) continue
      const url = tab.url ?? ''
      if (url.length === 0) continue
      if (detectPageKind(url) === 'unknown') continue
      count += 1
    }
    return count
  } catch {
    return 0
  }
}

/**
 * Rút domain từ URL (bỏ `www.`).
 *
 * Trả về chuỗi rỗng nếu URL khong parse duoc.
 */
export function domainOf(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
