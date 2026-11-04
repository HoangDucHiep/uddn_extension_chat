/**
 * Service worker — MV3.
 *
 * CHI lam viec nhe: mo/toggle side panel, context menu, command shortcut.
 * KHONG giu conversation state (SW bi kill sau ~30s) va KHONG proxy streaming.
 * Docs: docs/SYSTEM_DESIGN.md ADR-2, rule mv3-chrome.mdc §2
 */

import { handleRuntimeMessage } from '@/lib/selectionBridge'

/**
 * Mo side panel — chi chay duoc trong user gesture.
 * `chrome.sidePanel.open()` can chi mo panel o cua so trinh duyet hien tai.
 */
async function openSidePanel(windowId?: number): Promise<void> {
  try {
    const targetWindowId = windowId ?? (await getCurrentWindowId())
    if (targetWindowId === undefined) {
      console.warn('[sw] khong xac dinh duoc window id')
      return
    }
    await chrome.sidePanel.open({ windowId: targetWindowId })
  } catch (error) {
    // `chrome.sidePanel.open` that bai khi khong co user gesture.
    console.warn('[sw] khong mo duoc side panel:', error)
  }
}

/** Lay id cua cua so trinh duyet hien tai. */
async function getCurrentWindowId(): Promise<number | undefined> {
  try {
    const current = await chrome.windows.getCurrent()
    return current?.id
  } catch {
    return undefined
  }
}

// Click icon tren toolbar -> mo side panel.
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    void openSidePanel(tab.windowId)
  }
})

// Context menu "Mo Sidekick AI" tren trang web.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'sidekick-open',
    title: 'Mo Sidekick AI',
    contexts: ['page', 'selection'],
  })
})

chrome.contextMenus.onClicked.addListener((info: chrome.contextMenus.OnClickData) => {
  if (info.menuItemId === 'sidekick-open') {
    void openSidePanel()
  }
})

// Content script gui doan text user boi den (T-M1-02) → luu vao storage
// + thu mo panel. Panel dang dong van nhan duoc doan chon (storage).
chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  void handleRuntimeMessage(message, sender)
})
