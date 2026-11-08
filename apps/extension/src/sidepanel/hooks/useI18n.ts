import { useContext } from 'react'
import { I18nContext, type I18nContextValue } from '@/i18n/context'

/**
 * Hook `useI18n` — lay ham dich cua panel.
 *
 * Dung trong **moi** component can hien thi chuoi da dich:
 *
 * ```tsx
 * const { t } = useI18n()
 * return <button aria-label={t('composer.send')}>…</button>
 * ```
 *
 * Do `I18nProvider` lay `settings.uiLanguage` tu `useSettings()` (da lang
 * nghe `chrome.storage.onChanged`) → doi ngon ngu trong Settings **ap dung
 * ngay**, khong can reload panel.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
