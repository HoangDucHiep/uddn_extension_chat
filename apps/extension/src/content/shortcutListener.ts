/**
 * Bat shortcut **tu do** cua Sidekick tren trang web (FR-UX-01 — T-M1-18).
 *
 * ## Vì sao cần content script?
 *
 * Chrome **không** cho extension tự đổi shortcut của `chrome.commands`
 * (`chrome.commands.update()` là API riêng của Firefox). Nên Sidekick tự
 * bắt phím:
 *  1. Content script nghe `keydown` trên trang → khop shortcut đã lưu →
 *     gửi message lên service worker.
 *  2. Service worker nhận message → `chrome.sidePanel.open()` (thử) →
 *     nếu không được (thiếu user gesture) thì **tự mở panel** qua
 *     `chrome.windows` không? → không → chỉ ghi nhận.
 *
 * Thực tế: `chrome.sidePanel.open()` **cần user gesture**, mà message từ
 * content script **không** mang gesture → thường thất bại. Vì vậy shortcut
 * tự do được bắt ở **side panel** (extension page — có gesture thật khi
 * user đang tương tác trong panel) và ở **content script** chỉ dùng để
 * **báo** ý định mở panel (SW lưu trạng thái → panel mở sau sẽ nhận).
 *
 * File này **không** import React hay Zod → giữ content script IIFE nhỏ.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18
 */

import { SHORTCUT_TOGGLE_ACTION } from '../lib/shortcutProtocol.js'
import { matchesShortcut } from '../lib/shortcuts.js'
import { readShortcuts, resolveShortcut } from '../lib/shortcutStorage.js'
import { TOGGLE_PANEL_COMMAND } from '../lib/shortcuts.js'

/** Khoa luu shortcut da luu — dung de doc nhanh trong content script. */
const SHORTCUTS_STORAGE_KEY = 'sidekick.shortcuts'

/**
 * Doc shortcut hieu luc tu storage.
 *
 * @returns To hop phim dang gan (hoac `undefined`).
 */
async function readActiveShortcut(): Promise<string | undefined> {
  try {
    const shortcuts = await readShortcuts()
    return resolveShortcut(TOGGLE_PANEL_COMMAND, shortcuts)
  } catch {
    return undefined
  }
}

/**
 * Lang nghe phim tat tu do tren trang.
 *
 * Shortcut thay doi trong Settings → doc lai tu storage (khong can reload
 * trang) bang cach nghe `chrome.storage.onChanged`.
 *
 * @param doc - Document theo doi (mac dinh `document`).
 */
export function startShortcutListener(doc: Document = document): void {
  let activeShortcut: string | undefined

  const load = async (): Promise<void> => {
    activeShortcut = await readActiveShortcut()
  }

  const handleKeyDown = (event: Event): void => {
    const keyboardEvent = event as KeyboardEvent
    if (activeShortcut === undefined) return
    if (!matchesShortcut(keyboardEvent, activeShortcut)) return

    // Khong chan hanh dong mac dinh cua trang (Ctrl+W, Ctrl+T...) →
    // nhung to hop do da bi block o tang Settings roi.
    keyboardEvent.preventDefault()

    try {
      void chrome.runtime.sendMessage({ action: SHORTCUT_TOGGLE_ACTION })
    } catch {
      // Extension dang bi reload → bo qua.
    }
  }

  const handleStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return
    if (changes[SHORTCUTS_STORAGE_KEY] === undefined) return
    void load()
  }

  doc.addEventListener('keydown', handleKeyDown, true)

  try {
    chrome.storage.onChanged.addListener(handleStorageChanged)
  } catch {
    // Storage khong truy cap duoc → van dung shortcut mac dinh.
  }

  void load()
}
