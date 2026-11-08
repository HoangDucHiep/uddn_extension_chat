/**
 * Service worker — MV3.
 *
 * CHI lam viec nhe: mo/toggle side panel, context menu, command shortcut.
 * KHONG giu conversation state (SW bi kill sau ~30s) va KHONG proxy streaming.
 *
 * Logic nam trong file rieng (`panelController` / `contextMenus` / `commands`)
 * de test duoc trong jsdom; file nay chi la **wiring**.
 *
 * Docs: docs/SYSTEM_DESIGN.md ADR-2, §7.13, rule mv3-chrome.mdc §2
 */

import { handleRuntimeMessage } from '@/lib/selectionBridge'
import { handleShortcutRuntimeMessage } from '@/lib/shortcutBridge'
import { SETTINGS_STORAGE_KEY } from '@/lib/settings'
import { handleCommand } from './commands'
import { handleContextMenuClick, registerContextMenus } from './contextMenus'
import {
  applyOpenOnActionClick,
  isOpenOnActionClick,
  openSidePanel,
  writePanelOpenState,
} from './panelController'

// Native toggle cua Chrome (co tu Chrome 114). Top-level → chay lai moi
// lan SW khoi dong (SW bi kill sau ~30s) → behavior luon duoc upsert.
void applyOpenOnActionClick()

// Click icon tren toolbar.
// Native toggle da bat → Chrome KHONG dispatch `action.onClicked` → chi
// chay fallback khi `setPanelBehavior` that bai (Chrome cu / loi).
chrome.action.onClicked.addListener((tab) => {
  void (async () => {
    if (await isOpenOnActionClick()) return
    await openSidePanel(tab.windowId)
  })()
})

// Context menu "Mo Sidekick AI" + "Hoi Sidekick voi doan da chon".
chrome.runtime.onInstalled.addListener(() => {
  void registerContextMenus()
})

chrome.runtime.onStartup.addListener(() => {
  void registerContextMenus()
})

// Doi ngon ngu UI → nhan context menu doi theo (T-M1-17).
// `registerContextMenus` da idempotent (removeAll → create) nen goi lai
// an toan (rule mv3-chrome.mdc §2).
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (changes[SETTINGS_STORAGE_KEY] === undefined) return
  void registerContextMenus()
})

chrome.contextMenus.onClicked.addListener(
  (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    void handleContextMenuClick(info, tab)
  },
)

// Phim tat `Ctrl+Shift+K` → toggle panel.
chrome.commands.onCommand.addListener((command: string, tab?: chrome.tabs.Tab) => {
  void handleCommand(command, tab)
})

// Trang thai panel dang mo → phim tat biet phai mo hay dong.
// `onOpened` co tu Chrome 141, `onClosed` tu 142 → feature detection.
if (typeof chrome.sidePanel.onOpened !== 'undefined') {
  chrome.sidePanel.onOpened.addListener(() => {
    void writePanelOpenState(true)
  })
}

if (typeof chrome.sidePanel.onClosed !== 'undefined') {
  chrome.sidePanel.onClosed.addListener(() => {
    void writePanelOpenState(false)
  })
}

// Content script gui doan text user boi den (T-M1-02) → luu vao storage
// + thu mo panel. Panel dang dong van nhan duoc doan chon (storage).
chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  void handleRuntimeMessage(message, sender)
  void handleShortcutRuntimeMessage(message, sender)
})
