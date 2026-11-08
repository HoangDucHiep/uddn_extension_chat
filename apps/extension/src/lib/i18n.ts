import type { UiLanguage } from '@sidekick/shared'
import { createTranslator, resolveLanguage, type TranslationKey } from '@/i18n'
import { readSettings } from './settings'

/**
 * Doc ngon ngu UI hien tai tu `chrome.storage.local`.
 *
 * File nay **thuan** (khong React) → dung cho content script + service
 * worker (noi khong the dung hook) va test duoc truc tiep trong vitest.
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
    const settings = await readSettings()
    return resolveLanguage(settings.uiLanguage) ?? 'vi'
  } catch {
    return 'vi'
  }
}

/**
 * Tao ham dich cho 1 ngon ngu (dong bo, khong can await).
 *
 * @param language - Ngon ngu can dich.
 */
export function translatorFor(language: UiLanguage): Translator {
  return createTranslator(language)
}

/**
 * Tao ham dich theo ngon ngu dang luu trong storage (bat dong bo).
 *
 * Dung o noi khong phai React: content script (`selectionButton`) va
 * service worker (`contextMenus`).
 */
export async function getTranslator(): Promise<Translator> {
  return createTranslator(await readUiLanguage())
}
