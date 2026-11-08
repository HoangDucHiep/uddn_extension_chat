/**
 * Khoa storage cua Sidekick — tach rieng de **khong** keo theo Zod.
 *
 * ## Ly do tach file nay
 *
 * `lib/settings.ts` dung `settingsSchema` cua `@sidekick/shared` de validate →
 * import trang `@sidekick/shared` → **keo theo toan bo bundle `zod`** (~100 kB).
 *
 * Content script (`content/contentScript.ts`) can `getTranslator()` tu
 * `lib/i18n.ts` → `lib/settings.ts` → zod → `dist/content.js` phinh tu
 * **13.87 kB** len **~148 kB** (regression T-M1-17).
 *
 * Giai phap: cac **khoa storage** (chuoi han) + **doc ngon ngu** duoc tach
 * sang file nay — file nay **khong** import Zod → content script van nho.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.5
 */

/** Khoa storage luu cai dat nguoi dung. */
export const SETTINGS_STORAGE_KEY = 'sidekick.settings'

/**
 * Tien to khoa storage cua Sidekick.
 *
 * Xoá du lieu local (FR-SETTINGS-03) xoa theo prefix nay — nhung **giu**
 * `sidekick.onboarding.*` va `sidekick.preferredProvider` (xem
 * `deleteLocalSidekickData` trong `lib/settings.ts`).
 */
export const SIDEKICK_STORAGE_PREFIX = 'sidekick.'

/** Khoa onboarding — **khong** xoa khi xoa du lieu local. */
export const PRESERVED_STORAGE_KEYS = [
  'sidekick.onboarding.completed',
  'sidekick.preferredProvider',
] as const

/**
 * Ngon ngu UI dang luu trong settings.
 *
 * Doc **thuoc tinh `uiLanguage`** truc tiep tu storage — khong validate bang
 * `uiLanguageSchema` (Zod) de khong keo Zod vao bundle cua content script.
 *
 * Gia tri sai → tra `undefined` (caller fallback sang tieng Viet).
 *
 * @returns Ngon ngu luu trong storage, hoac `undefined` neu chua co / sai.
 */
export async function readStoredUiLanguage(): Promise<'vi' | 'en' | undefined> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
    const raw = stored[SETTINGS_STORAGE_KEY]
    if (typeof raw !== 'object' || raw === null) return undefined

    const language = (raw as Record<string, unknown>)['uiLanguage']
    return language === 'vi' || language === 'en' ? language : undefined
  } catch {
    // Storage loi → fallback ve tieng Viet (mac dinh an toan).
    return undefined
  }
}
