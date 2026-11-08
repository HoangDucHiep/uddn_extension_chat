import { createContext } from 'react'
import type { UiLanguage } from '@sidekick/shared'
import { createTranslator } from '@/i18n'
import type { Translator } from '@/lib/i18n'

/**
 * React context cua i18n (FR-SETTINGS-06 — T-M1-17).
 *
 * Tach rieng `i18n/context.ts` (khong JSX) de **content script + service
 * worker** khong phai import React — `i18n/index.ts` giu nguyen phien ban
 * "thuan" cho 2 noi do.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

/** Gia tri duoc chia se qua context. */
export interface I18nContextValue {
  /** Ngon ngu dang hien thi. */
  language: UiLanguage
  /** Ham dich — tra ve chuoi da thay the placeholder. */
  t: Translator
}

/**
 * Context i18n.
 *
 * Gia tri mac dinh = **tieng Viet** (dictionary `vi`) → component render
 * dung nghia du khi quen boc `I18nProvider` (hoac khi test render rieng
 * component ma khong boc provider).
 */
export const I18nContext = createContext<I18nContextValue>({
  language: 'vi',
  t: createTranslator('vi'),
})
