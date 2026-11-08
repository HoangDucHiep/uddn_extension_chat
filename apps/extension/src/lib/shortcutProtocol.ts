/**
 * Action gui tin nhan tu content script len service worker (T-M1-18).
 *
 * File nay **khong** import Zod hay thu vien ngoai → content script dung
 * duoc (content script phai build o dang IIFE 1 file).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */

/** Action mo/dong side panel khi user bam shortcut tu do. */
export const SHORTCUT_TOGGLE_ACTION = 'sidekick:shortcut-toggle'

/** Shape message gui tu content script. */
export interface ShortcutToggleMessage {
  action: typeof SHORTCUT_TOGGLE_ACTION
}

/**
 * Kiem tra mot value co phai message shortcut hop le khong.
 *
 * @param value - Value nhan duoc tu `chrome.runtime.onMessage`.
 */
export function isShortcutToggleMessage(value: unknown): value is ShortcutToggleMessage {
  if (typeof value !== 'object' || value === null) return false
  return (value as { action?: unknown }).action === SHORTCUT_TOGGLE_ACTION
}
