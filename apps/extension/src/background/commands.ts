/**
 * Phim tat cua extension (T-M1-03, FR-UX-01).
 *
 * Khai bao trong `manifest.json` → khoi `commands`:
 *
 * ```json
 * "sidekick-toggle-panel": {
 *   "suggested_key": { "default": "Ctrl+Shift+K", "mac": "Command+Shift+K" },
 *   "description": "Mo / dong Sidekick AI"
 * }
 * ```
 *
 * Tu xu ly toggle (khong dung `_execute_action`) de kiem soat duoc hanh vi
 * mo/dong — `_execute_action` se bi native `openPanelOnActionClick` "an".
 *
 * File nay **thuan** de test duoc trong jsdom.
 * Docs: docs/SYSTEM_DESIGN.md §7.13
 */

import { toggleSidePanel } from './panelController.js'

/** Id cua command toggle panel. */
export const COMMAND_TOGGLE_PANEL = 'sidekick-toggle-panel'

/**
 * Map id command → handler.
 *
 * Chi 1 command (toggle panel) — dung map de them command moi ma khong
 * phai sua if/else.
 */
const COMMAND_HANDLERS: Record<string, (tab?: chrome.tabs.Tab) => Promise<void>> = {
  [COMMAND_TOGGLE_PANEL]: async (tab) => {
    await toggleSidePanel(tab?.windowId)
  },
}

/**
 * Xu ly phim tat.
 *
 * @param command - Id cua command vua duoc kich hoat.
 * @param tab - Tab dang active (neu co).
 */
export async function handleCommand(
  command: string,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  const handler = COMMAND_HANDLERS[command]
  if (handler === undefined) return

  await handler(tab)
}
