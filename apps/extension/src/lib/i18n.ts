import type { UiLanguage } from '@sidekick/shared'
import { createTranslator, resolveLanguage, type TranslationKey } from '@/i18n'
import { readStoredUiLanguage } from './storageKeys'

/**
 * Module i18n — cho **side panel** (dictionary day du).
 *
 * File nay **thuan** (khong React) → test duoc truc tiep trong vitest.
 *
 * > **Bundle ngoai side panel** (content script + service worker) dung
 * > `lib/i18nSurface.ts` → chi 4 khoa → `dist/content.js` nho.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

/** Ham dich — tra ve chuoi da thay the placeholder. */
export type Translator = (
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>,
) => string

/**
 * Ngon ngu UI dang luu.
 *
 * Chua co setting / setting sai / loi storage → mac dinh `vi`.
 */
export async function readUiLanguage(): Promise<UiLanguage> {
  try {
    return resolveLanguage(await readStoredUiLanguage()) ?? 'vi'
  } catch {
    return 'vi'
  }
}

/**
 * Tao ham dich cho mot ngon ngu (dong bo, khong can await).
 *
 * @param language - Ngon ngu can dich.
 */
export function translatorFor(language: UiLanguage): Translator {
  return createTranslator(language)
}
