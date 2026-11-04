/**
 * Theo doi vung text user boi den va hien nut nobi "Hoi Sidekick" (T-M1-02).
 *
 * Luong:
 *  1. User bôi đen (`mouseup` hoac `keyup`) → debounce → doc selection.
 *  2. Selection co y nghia → tinh vi tri neo → hien nut nobi.
 *  3. Selection bi bo / trang scroll → an nut.
 *
 * Khong dung `chrome.*` o file nay (tru `sendMessage` trong `contentScript`)
 * → de test duoc trong jsdom.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4
 */

import {
  readSelectionFromDocument,
  selectionAnchorRect,
  type SelectionAnchor,
} from './selection.js'
import type { SelectionButtonHandle } from './selectionButton.js'

/** Do tre debounce (ms) — cho trinh duyet cap nhat selection sau khi chuot tha. */
export const SELECTION_DEBOUNCE_MS = 120

/** Loi giu doan text vua boi den. */
export interface SelectionWatcherOptions {
  /** Nut nobi hien/an. */
  button: SelectionButtonHandle
  /** Document theo doi (mac dinh `document`). */
  doc?: Document
  /** Thoi gian debounce (mac dinh `SELECTION_DEBOUNCE_MS`). */
  debounceMs?: number
}

/** Handle cua watcher. */
export interface SelectionWatcherHandle {
  /** Bat theo doi. */
  start: () => void
  /** Tat theo doi va go listener. */
  stop: () => void
  /** Doc selection hien tai + cap nhat nut (dung cho test). */
  refresh: () => void
}

/**
 * Tao watcher selection.
 *
 * @param options - Nut nobi + callback.
 */
export function createSelectionWatcher(options: SelectionWatcherOptions): SelectionWatcherHandle {  const doc = options.doc ?? document
  const debounceMs = options.debounceMs ?? SELECTION_DEBOUNCE_MS

  let timer: ReturnType<typeof setTimeout> | undefined
  let started = false
  /** Text hien tai dang hien tren nut — tranh gui trung. */
  let currentText = ''

  const hideButton = (): void => {
    currentText = ''
    options.button.hide()
  }

  const refresh = (): void => {
    const snapshot = readSelectionFromDocument(doc)

    // Khong co selection hop le → an nut.
    if (snapshot === undefined) {
      hideButton()
      return
    }

    // Selection doi → dung hien selection cu (neu dang hien).
    if (snapshot.text === currentText) return

    currentText = snapshot.text

    // Khong co rect (jsdom, trang khong layout) → dung hien nut o (0, 0).
    const anchor: SelectionAnchor =
      snapshot.rect === undefined
        ? { left: 0, top: 0, placement: 'below' }
        : selectionAnchorRect(snapshot.rect, {
            width: doc.defaultView?.innerWidth ?? 0,
            height: doc.defaultView?.innerHeight ?? 0,
          })

    options.button.show(anchor)
  }

  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      refresh()
    }, debounceMs)
  }

  const handleMouseUp = (): void => {
    schedule()
  }

  const handleKeyUp = (event: KeyboardEvent): void => {
    // Chi quan tam phim co the tao selection (Shift+arrow, Ctrl+A).
    if (event.shiftKey || (event.ctrlKey && event.key.toLowerCase() === 'a')) {
      schedule()
    }
  }

  // Selection bi thu hoi → an nut ngay (khong debounce).
  const handleSelectionChange = (): void => {
    const selection = doc.getSelection()
    if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) {
      hideButton()
    }
  }

  const handleScroll = (): void => {
    // Trang scroll → vung chon doi toa do → an nut cho an toan.
    hideButton()
  }

  const start = (): void => {
    if (started) return
    started = true

    doc.addEventListener('mouseup', handleMouseUp)
    doc.addEventListener('keyup', handleKeyUp)
    doc.addEventListener('selectionchange', handleSelectionChange)
    doc.defaultView?.addEventListener('scroll', handleScroll, true)
  }

  const stop = (): void => {
    if (!started) return
    started = false

    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }

    doc.removeEventListener('mouseup', handleMouseUp)
    doc.removeEventListener('keyup', handleKeyUp)
    doc.removeEventListener('selectionchange', handleSelectionChange)
    doc.defaultView?.removeEventListener('scroll', handleScroll, true)

    hideButton()
  }

  return { start, stop, refresh }
}
