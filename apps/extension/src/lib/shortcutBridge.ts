import { isShortcutToggleMessage } from './shortcutProtocol'

/**
 * Cầu nối shortcut tu do → service worker (T-M1-18, FR-UX-01).
 *
 * Chrome **khong** cho extension doi shortcut cua `chrome.commands` →
 * Sidekick tu bat phim o content script. Content script gui message len
 * SW → SW thu mo side panel.
 *
 * `chrome.sidePanel.open()` **chi chay duoc trong user gesture** → message
 * tu content script thuong **khong** mang gesture → `open()` that bai. Ta
 * **khong nem loi** va bo qua: nguoi dung van dung duoc shortcut **native**
 * cua Chrome (`sidekick-toggle-panel`) de mo panel tu khi panel dong.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18, rule mv3-chrome.mdc §3
 */

/** Ket qua xu ly message shortcut. */
export interface ShortcutBridgeResult {
  /** Panel co duoc mo hay khong (that bai → `false`). */
  panelOpened: boolean
}

/**
 * Xu ly message "mo/dong panel" tu content script.
 *
 * @param windowId - Id cua so trinh duyet (de goi `sidePanel.open`).
 * @returns Ket qua xu ly.
 */
export async function handleShortcutMessage(
  windowId: number | undefined,
): Promise<ShortcutBridgeResult> {
  if (windowId === undefined) {
    return { panelOpened: false }
  }

  try {
    await chrome.sidePanel.open({ windowId })
    return { panelOpened: true }
  } catch {
    // Chrome tu choi (thieu user gesture) → im lang.
    return { panelOpened: false }
  }
}

/**
 * Handler `chrome.runtime.onMessage` cho action shortcut.
 *
 * @param message - Value nhan duoc tu `chrome.runtime.onMessage`.
 * @param sender - Thong tin sender (dung `sender.tab?.windowId`).
 * @returns Ket qua xu ly, hoac `undefined` neu khong phai message shortcut.
 */
export async function handleShortcutRuntimeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<ShortcutBridgeResult | undefined> {
  if (!isShortcutToggleMessage(message)) return undefined

  return handleShortcutMessage(sender.tab?.windowId)
}
