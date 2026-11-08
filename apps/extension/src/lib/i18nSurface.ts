import { createOutsidePanelTranslator } from '@/i18n/outsidePanel'
import type { OutsidePanelKey } from '@/i18n/surface'
import { resolveLanguage } from '@/i18n/format'
import { readStoredUiLanguage } from './storageKeys'

/**
 * Module i18n — cho **bundle ngoai side panel** (content script + service worker).
 *
 * Chi dung **4 khoa** (`content.*` · `background.menu.*`) → dung dictionary
 * rut gon `i18n/outsidePanel.ts` → `dist/content.js` nho.
 *
 * > **Khong** dung `lib/i18n.ts` o day — file do import dictionary **day du**
 * > (~34 kB) → content script phinh tu 13.87 kB len ~46 kB.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

/** Ham dich — tra ve chuoi da thay the placeholder. */
export type SurfaceTranslator = (
  key: OutsidePanelKey,
  params?: Readonly<Record<string, string | number>>,
) => string

/**
 * Tao ham dich theo ngon ngu dang luu trong storage (bat dong bo).
 *
 * Dung o noi khong phai React: content script (`selectionButton`) va
 * service worker (`contextMenus`).
 */
export async function getSurfaceTranslator(): Promise<SurfaceTranslator> {
  const language = resolveLanguage(await readStoredUiLanguage()) ?? 'vi'
  return createOutsidePanelTranslator(language)
}
