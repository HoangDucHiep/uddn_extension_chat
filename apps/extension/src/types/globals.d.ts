/**
 * Khai bao global cho extension.
 *
 * `window.__sidekickExtractContent` duoc gan trong content script
 * (isolated world) de panel goi qua `chrome.scripting.executeScript`.
 * Docs: docs/SYSTEM_DESIGN.md §3 (content/extractor.ts)
 */

import type { ExtractedPage } from '../content/extractor.js'

declare global {
  interface Window {
    /** Trich metadata trang (M0). */
    __sidekickExtractMetadata?: () => {
      title: string
      url: string
      description: string
      selectedText: string
    }
    /** Trich noi dung chinh cua trang (M1 — Readability-lite). */
    __sidekickExtractContent?: () => ExtractedPage
    /**
     * Do vung text user dang boi tren trang (T-M1-02).
     *
     * Panel goi qua `chrome.scripting.executeScript` → ham nay phai tu chua,
     * khong duoc tham chieu bien module-scope.
     */
    __sidekickGetSelection?: () => {
      text: string
      title: string
      url: string
    } | null
  }
}

export {}
