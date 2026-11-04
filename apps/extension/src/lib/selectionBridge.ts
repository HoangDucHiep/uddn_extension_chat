/**
 * Cầu nối selection giữa content script → service worker → side panel
 * (T-M1-02).
 *
 * Service worker **khong** giu state (MV3 SW bi kill sau ~30s) → doan chon
 * duoc ghi vao `chrome.storage.local`, panel tu doc khi mo.
 *
 * `chrome.sidePanel.open()` chi chay duoc trong user gesture. Message tu
 * content script den qua SW co the khong con "gesture" → ta **thu** mo
 * panel, neu that bai thi im lang (doan chon da luu → panel mo sau van
 * nhan duoc).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4, rule mv3-chrome.mdc §3
 */

import { writePendingSelection } from './storage'
import { isSelectionMessage, type PendingSelection } from './selectionProtocol'

/** Ket qua xu ly message selection. */
export interface SelectionBridgeResult {
  /** Doan chon da duoc luu vao storage hay khong. */
  stored: boolean
  /** Panel co duoc mo tu dong hay khong (that bai → `false`). */
  panelOpened: boolean
}

/**
 * Luu doan chon va thu mo side panel.
 *
 * @param selection - Doan chon tu content script.
 * @param windowId - Id cua so trinh duyet (de goi `sidePanel.open`).
 */
export async function handleSelectionMessage(
  selection: PendingSelection,
  windowId: number | undefined,
): Promise<SelectionBridgeResult> {
  await writePendingSelection(selection)

  if (windowId === undefined) {
    return { stored: true, panelOpened: false }
  }

  const panelOpened = await tryOpenSidePanel(windowId)
  return { stored: true, panelOpened }
}

/**
 * Thu mo side panel — khong throw khi Chrome tu choi (thieu user gesture).
 *
 * @param windowId - Id cua so trinh duyet.
 */
export async function tryOpenSidePanel(windowId: number): Promise<boolean> {
  try {
    await chrome.sidePanel.open({ windowId })
    return true
  } catch {
    // `chrome.sidePanel.open` that bai khi khong co user gesture →
    // panel se tu nhan doan chon khi user mo sau.
    return false
  }
}

/**
 * Handler `chrome.runtime.onMessage` cho action selection.
 *
 * @param message - Value nhan duoc tu `chrome.runtime.onMessage`.
 * @param sender - Thong tin sender (dung `sender.tab?.windowId`).
 */
export async function handleRuntimeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<SelectionBridgeResult | undefined> {
  if (!isSelectionMessage(message)) return undefined

  const windowId = sender.tab?.windowId
  return handleSelectionMessage(message.payload, windowId)
}
