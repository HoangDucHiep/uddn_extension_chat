/**
 * Content script — doc noi dung trang de dua lam context.
 *
 * KHONG giu state lon o day. Panel goi `chrome.scripting.executeScript` de
 * trich xuat noi dung theo yeu cau (M0: chi doc metadata trang;
 * M1: trich noi dung chinh bang Readability-lite — `extractor.ts`).
 * Docs: docs/SYSTEM_DESIGN.md §8 (Content extraction)
 */

import { extractPageContent, type ExtractedPage } from './extractor.js'

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

/** Action cua message noi giua panel va content script. */
export const EXTRACT_CONTENT_ACTION = 'sidekick:extract-content'

/**
 * Trich noi dung chinh cua trang hien tai.
 *
 * Dung `window` de panel goi duoc qua `chrome.scripting.executeScript`
 * (noi dung bi serialize qua JSON → phai la du lieu thuan).
 */
export function extractContent(): ExtractedPage {
  return extractPageContent(document)
}

// Expose ham trich xuat de service worker goi qua chrome.scripting.
Object.assign(window, {
  __sidekickExtractMetadata: extractPageMetadata,
  __sidekickExtractContent: extractContent,
})

// Cho phep panel goi yêu cau trich noi dung qua runtime message
// (dung chung voi selection context ở T-M1-02).
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === 'object' &&
    message !== null &&
    (message as { action?: unknown }).action === EXTRACT_CONTENT_ACTION
  ) {
    try {
      sendResponse({ ok: true, page: extractContent() })
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return true
  }
  return false
})

console.warn('[sidekick] content script da san sang')
