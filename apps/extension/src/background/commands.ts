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
 * Xu ly phim tat.
 *
 * @param command - Id cua command vua duoc kich hoat.
 * @param tab - Tab dang active (neu co).
 */
export async function handleCommand(
  command: string,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (command !== COMMAND_TOGGLE_PANEL) return

  await toggleSidePanel(tab?.windowId)
}
