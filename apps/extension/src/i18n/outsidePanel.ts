/**
 * Module i18n — **ngoai side panel** (content script + service worker).
 *
 * ## Ly do tach rieng
 *
 * `i18n/index.ts` import dictionary **day du** (`vi.ts` ~17 kB + `en.ts`
 * ~16 kB) → content script (`dist/content.js`) se phinh tu **13.87 kB** len
 * **~46 kB** du chi can **4** khoa.
 *
 * File nay chi import **dictionary rut gon** (`outsidePanel.vi.ts` ·
 * `outsidePanel.en.ts`) → bundle ngoai panel nho.
 *
 * > **Quy tac:** khoa "ngoai panel" phai co **o ca 3 noi**:
 * > `outsidePanel.vi.ts` (nguon su that) · `outsidePanel.en.ts` (kieu rang
 * > buoc) · `surface.ts` (danh sach khoa de kiem tra). Thieu mot trong ba
 * > → `pnpm typecheck` hoac unit test bat.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

import { outsidePanelEnDictionary } from './outsidePanel.en.js'
import { outsidePanelViDictionary } from './outsidePanel.vi.js'
import { formatMessage } from './format.js'
import type { OutsidePanelKey } from './surface.js'

export type { OutsidePanelKey }

/** Dictionary rut gon theo ngon ngu. */
const OUTSIDE_PANEL_DICTIONARIES = {
  vi: outsidePanelViDictionary,
  en: outsidePanelEnDictionary,
} as const

/**
 * Tao ham dich cho khoa "ngoai panel".
 *
 * Key ngoai danh sach → tra chinh key do (khong nem loi) de UI khong vỡ.
 *
 * @param language - Ngon ngu can dich.
 */
export function createOutsidePanelTranslator(
  language: 'vi' | 'en',
): (key: OutsidePanelKey, params?: Readonly<Record<string, string | number>>) => string {
  const dictionary = OUTSIDE_PANEL_DICTIONARIES[language] ?? outsidePanelViDictionary
  return (key, params) => {
    const template = dictionary[key]
    if (template === undefined) return key
    return formatMessage(template, params)
  }
}
