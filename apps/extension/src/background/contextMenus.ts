/**
 * Context menu cua extension (T-M1-03, FR-UX-01).
 *
 * 2 muc:
 *  1. "Mo Sidekick AI" — `contexts: ['page']` → mo panel.
 *  2. "Hoi Sidekick voi doan da chon" — `contexts: ['selection']` → ghi doan
 *     chon vao `chrome.storage.local` (panel tu nhan) + mo panel.
 *
 * Muc 2 tai dung **duong B** cua T-M1-02 (FR-CONTEXT-04) → doan chon
 * vao context voi `tier: 'selection'` (cao nhat).
 *
 * File nay **thuan** de test duoc trong jsdom.
 * Docs: docs/SYSTEM_DESIGN.md §7.13, §7.3.4
 */

import { normalizeSelectionText } from '../content/selection.js'
import { isMeaningfulSelection } from '../content/selection.js'
import { selectionItemId, type PendingSelection } from '../lib/selectionProtocol.js'
import { writePendingSelection } from '../lib/storage.js'
import { getSurfaceTranslator } from '../lib/i18nSurface.js'
import { openSidePanel } from './panelController.js'

/** Id cua muc menu "Mo Sidekick AI". */
export const CONTEXT_MENU_OPEN_ID = 'sidekick-open'

/** Id cua muc menu "Hoi Sidekick voi doan da chon". */
export const CONTEXT_MENU_ASK_SELECTION_ID = 'sidekick-ask-selection'

/**
 * Dang ky context menu cua extension.
 *
 * `removeAll()` chay **truoc** `create()` → id trung khong bao gio xay ra
 * (update extension se tao lai menu).
 *
 * @returns Khong bao gio throw.
 */
export async function registerContextMenus(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll()
  } catch {
    // Chrome cu khong ho tro Promise → bo qua, `create` van chay.
  }

  // Nhan menu theo ngon ngu UI (T-M1-17) → doc storage truoc khi tao.
  const t = await getSurfaceTranslator()

  try {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_OPEN_ID,
      title: t('background.menu.open'),
      contexts: ['page'],
    })
  } catch {
    // Menu da ton tai → bo qua.
  }

  try {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ASK_SELECTION_ID,
      title: t('background.menu.askSelection'),
      contexts: ['selection'],
    })
  } catch {
    // Menu da ton tai → bo qua.
  }
}

/**
 * Xu ly click context menu.
 *
 * @param info - Du lieu cua `chrome.contextMenus.onClicked`.
 * @param tab - Tab dang active (neu co).
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (info.menuItemId === CONTEXT_MENU_OPEN_ID) {
    await openSidePanel(tab?.windowId)
    return
  }

  if (info.menuItemId !== CONTEXT_MENU_ASK_SELECTION_ID) return

  const rawText = info.selectionText ?? ''
  if (rawText.length === 0) return

  const text = normalizeSelectionText(rawText)
  // Doan qua ngan sach toi thieu → co the la rac → khong tao context item.
  if (!isMeaningfulSelection(text)) return

  const pending: PendingSelection = {
    id: selectionItemId(text),
    text,
    url: info.pageUrl ?? tab?.url ?? '',
    title: tab?.title ?? '',
    tabId: tab?.id,
    createdAt: Date.now(),
  }

  await writePendingSelection(pending)
  await openSidePanel(tab?.windowId)
}
