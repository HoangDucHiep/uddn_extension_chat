/**
 * Content script — doc noi dung trang de dua lam context.
 *
 * KHONG giu state lon o day. Panel goi `chrome.scripting.executeScript` de
 * trich xuat noi dung theo yeu cau (M0: chi doc metadata trang;
 * M1: trich noi dung chinh bang Readability-lite — `extractor.ts`).
 *
 * T-M1-02 bo sung: theo doi vung text user boi den → hien nut nobi
 * "Hoi Sidekick" → click gui doan text len service worker.
 *
 * Docs: docs/SYSTEM_DESIGN.md §8 (Content extraction), §7.3.4
 */

import { extractPageContent, type ExtractedPage } from './extractor.js'
import { createSelectionButton, SELECTION_BUTTON_HOST_ID } from './selectionButton.js'
import { createSelectionWatcher } from './selectionWatcher.js'
import { normalizeSelectionText } from './selection.js'
import { SELECTION_ACTION, selectionItemId, type PendingSelection } from '../lib/selectionProtocol.js'
import { getTranslator } from '../lib/i18n.js'
import { startShortcutListener } from './shortcutListener.js'

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

/**
 * Doc vung text user dang boi tren trang (duong B — nut trong panel).
 *
 * Panel goi qua `chrome.scripting.executeScript` → ham nay phai tu chua,
 * khong duoc tham chieu bien module-scope.
 */
export function getSelectionSnapshot(): { text: string; title: string; url: string } | null {
  const selection = window.getSelection()
  if (selection === null) return null
  if (selection.rangeCount === 0) return null

  const text = normalizeSelectionText(selection.toString())
  if (text.length === 0) return null

  return { text, title: document.title, url: window.location.href }
}

// Expose ham trich xuat de service worker goi qua chrome.scripting.
Object.assign(window, {
  __sidekickExtractMetadata: extractPageMetadata,
  __sidekickExtractContent: extractContent,
  __sidekickGetSelection: getSelectionSnapshot,
})

// Cho phep panel goi yêu cau trich xuat qua runtime message
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

/**
 * Khoi dong theo doi selection + nut nobi (T-M1-02).
 *
 * Khong chay tren trang cua chinh extension (sidepanel/options) de tranh
 * nut nobi lo trong UI cua Sidekick.
 */
function startSelectionWatcher(): void {
  const isExtensionPage = window.location.protocol === 'chrome-extension:'
  if (isExtensionPage) return

  const button = createSelectionButton({
    // Nhan nut mac dinh (tieng Viet) — duoc cap nhat ngay sau khi doc
    // ngon ngu tu storage (T-M1-17).
    label: 'Hoi Sidekick',
    ariaLabel: 'Hoi Sidekick về đoạn văn bản đã bôi đen',
    onSelect: () => {
      const snapshot = getSelectionSnapshot()
      if (snapshot === null) return

      const payload: PendingSelection = {
        id: selectionItemId(snapshot.text),
        text: snapshot.text,
        url: snapshot.url,
        title: snapshot.title,
        tabId: undefined,
        createdAt: Date.now(),
      }

      // Service worker se luu vao storage + thu mo panel.
      // Khong await: click handler phai phan hoi ngay.
      try {
        void chrome.runtime.sendMessage({ action: SELECTION_ACTION, payload })
      } catch {
        // Extension dang bi reload → bo qua.
      }
    },
  })

  const watcher = createSelectionWatcher({
    button,
  })

  watcher.start()
}

/**
 * Cap nhat nhan nut theo ngon ngu UI (T-M1-17).
 *
 * Content script doc `chrome.storage.local` (co quyen nhu extension) →
 * doi ngon ngu trong Settings → nhan nut doi theo ngay (khong can reload
 * trang).
 */
async function localizeSelectionButton(): Promise<void> {
  try {
    const t = await getTranslator()
    const host = document.getElementById(SELECTION_BUTTON_HOST_ID)
    const shadow = host?.shadowRoot
    if (shadow === null || shadow === undefined) return

    const button = shadow.querySelector('button')
    const label = shadow.querySelector('span')
    if (button === null || label === null) return

    const buttonLabel = t('content.selectionButton')
    label.textContent = buttonLabel
    button.setAttribute(
      'aria-label',
      t('content.selectionButtonLabel', { label: buttonLabel }),
    )
  } catch {
    // Storage loi → giu nhan mac dinh.
  }
}

startSelectionWatcher()
void localizeSelectionButton()

// Shortcut tu do cua Sidekick (T-M1-18) → bam phim tren trang → mo panel.
startShortcutListener()

console.warn('[sidekick] content script da san sang')
