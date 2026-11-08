import { useMemo, type ReactNode } from 'react'
import type { UiLanguage } from '@sidekick/shared'
import { I18nContext } from '@/i18n/context'
import { translatorFor } from '@/lib/i18n'

/**
 * Provider cua i18n (FR-SETTINGS-06 — T-M1-17).
 *
 * Boc o `App.tsx` (cao nhat trong side panel) → moi component con deu goi
 * `useI18n()` duoc ma khong phai truyen `t` qua props.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */
export interface I18nProviderProps {
  /** Ngon ngu dang hien thi (thuong la `settings.uiLanguage`). */
  language: UiLanguage
  /** Noi dung ben trong provider. */
  children: ReactNode
}

export function I18nProvider({ language, children }: I18nProviderProps) {
  // `translatorFor` tao ham moi moi khi doi ngon ngu → `t` doi identity
  // → moi component dung `t` re-render.
  const value = useMemo(
    () => ({ language, t: translatorFor(language) }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
