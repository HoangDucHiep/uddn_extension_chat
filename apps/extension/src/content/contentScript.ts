/**
 * Content script — doc noi dung trang de dua lam context.
 *
 * KHONG giu state lon o day. Panel goi `chrome.scripting.executeScript` de
 * trich xuat noi dung theo yeu cau (M0: chi doc metadata trang).
 * Docs: docs/SYSTEM_DESIGN.md §8 (Content extraction)
 */

/** Metadata trang, gui ve panel khi duoc hoi. */
export interface PageMetadata {
  title: string
  url: string
  description: string
  selectedText: string
}

/** Trich metadata trang hien tai. */
export function extractPageMetadata(): PageMetadata {
  return {
    title: document.title,
    url: window.location.href,
    description:
      document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    selectedText: window.getSelection()?.toString().trim().slice(0, 5000) ?? '',
  }
}

// Expose ham trich xuat de service worker goi qua chrome.scripting.
Object.assign(window, {
  __sidekickExtractMetadata: extractPageMetadata,
})

console.warn('[sidekick] content script da san sang')
