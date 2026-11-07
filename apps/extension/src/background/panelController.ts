/**
 * Dieu khien side panel tu service worker (T-M1-03, FR-UX-01).
 *
 * 3 duong mo panel — tat ca deu la **user gesture** nen `sidePanel.open()`
 * hop le:
 *  1. Click icon toolbar → native `openPanelOnActionClick` (Chrome tu toggle).
 *  2. Context menu → `handleContextMenuClick`.
 *  3. Phim tat → `handleCommand`.
 *
 * File nay **thuan** (chi dung `chrome.*`) de test duoc trong jsdom.
 * Moi ham bat loi → service worker khong bao gio crash.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.13, rule mv3-chrome.mdc §2, §3
 */

/**
 * Khoa luu trang thai panel dang mo (chi trong `chrome.storage.session`).
 *
 * `storage.session` song suot phien trinh duyet → khong mat khi service
 * worker bi kill (~30s). Khong dung `storage.local` vi trang thai nay chi
 * co y nghia trong phien hien tai.
 */
export const PANEL_OPEN_STATE_KEY = 'sidekick.panelOpen'

/** Ket qua toggle panel. */
export type PanelToggleResult = 'opened' | 'closed' | 'noop'

/**
 * Bat che do "click icon toolbar → toggle panel" (native cua Chrome).
 *
 * API nay co tu **Chrome 114** → khop `minimum_chrome_version`.
 * Goi o top-level cua service worker: MV3 kill SW sau ~30s → top-level
 * chay lai → behavior luon duoc upsert lai (idempotent).
 *
 * @returns `true` neu bat thanh cong.
 */
export async function applyOpenOnActionClick(): Promise<boolean> {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    return true
  } catch {
    // Chrome cu khong ho tro → fallback sang `action.onClicked`.
    return false
  }
}

/**
 * Kiem tra native toggle da duoc bat hay chua.
 *
 * Khi `openPanelOnActionClick` = true, Chrome **khong** dispatch
 * `action.onClicked` → fallback phai bi chan de tranh mo 2 lan.
 *
 * @returns `true` neu native toggle dang bat.
 */
export async function isOpenOnActionClick(): Promise<boolean> {
  try {
    const behavior = await chrome.sidePanel.getPanelBehavior()
    return behavior.openPanelOnActionClick === true
  } catch {
    return false
  }
}

/**
 * Doc trang thai panel dang mo.
 *
 * @returns `true` neu panel dang mo.
 */
export async function readPanelOpenState(): Promise<boolean> {
  try {
    const stored = await chrome.storage.session.get(PANEL_OPEN_STATE_KEY)
    return stored[PANEL_OPEN_STATE_KEY] === true
  } catch {
    return false
  }
}

/**
 * Luu trang thai panel dang mo.
 *
 * @param open - Panel dang mo hay dong.
 */
export async function writePanelOpenState(open: boolean): Promise<void> {
  try {
    await chrome.storage.session.set({ [PANEL_OPEN_STATE_KEY]: open })
  } catch {
    // Storage khong truy cap duoc → bo qua (toggle sau se dung fallback).
  }
}

/**
 * Lay id cua cua so trinh duyet hien tai.
 *
 * @returns Id cua so, hoac `undefined` khi khong xac dinh duoc.
 */
async function getCurrentWindowId(): Promise<number | undefined> {
  try {
    const current = await chrome.windows.getCurrent()
    return current?.id
  } catch {
    return undefined
  }
}

/**
 * Mo side panel — chi chay duoc trong user gesture.
 *
 * @param windowId - Id cua so (mac dinh: cua so hien tai).
 * @returns `true` neu mo thanh cong.
 */
export async function openSidePanel(windowId?: number): Promise<boolean> {
  try {
    const targetWindowId = windowId ?? (await getCurrentWindowId())
    if (targetWindowId === undefined) return false

    await chrome.sidePanel.open({ windowId: targetWindowId })
    return true
  } catch {
    // `chrome.sidePanel.open` that bai khi khong co user gesture.
    return false
  }
}

/**
 * Dong side panel.
 *
 * `chrome.sidePanel.close` co tu **Chrome 141** → feature detection.
 *
 * @param windowId - Id cua so (mac dinh: cua so hien tai).
 * @returns `true` neu dong thanh cong.
 */
export async function closeSidePanel(windowId?: number): Promise<boolean> {
  try {
    if (typeof chrome.sidePanel.close !== 'function') return false

    const targetWindowId = windowId ?? (await getCurrentWindowId())
    if (targetWindowId === undefined) return false

    await chrome.sidePanel.close({ windowId: targetWindowId })
    return true
  } catch {
    // Khong dong duoc (panel dang dong) → bo qua.
    return false
  }
}

/**
 * Toggle side panel theo trang thai hien tai.
 *
 * - Panel dang dong → `open()` → `'opened'`.
 * - Panel dang mo → `close()` → `'closed'`.
 * - Khong dong duoc (Chrome < 141) → `'noop'`.
 *
 * @param windowId - Id cua so (mac dinh: cua so hien tai).
 */
export async function toggleSidePanel(windowId?: number): Promise<PanelToggleResult> {
  const isOpen = await readPanelOpenState()
  if (!isOpen) {
    const opened = await openSidePanel(windowId)
    return opened ? 'opened' : 'noop'
  }

  const closed = await closeSidePanel(windowId)
  return closed ? 'closed' : 'noop'
}
