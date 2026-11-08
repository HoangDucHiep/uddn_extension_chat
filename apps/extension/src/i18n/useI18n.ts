import { useContext } from 'react'
import { I18nContext, type I18nContextValue } from './context'

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
 * File nay o `src/i18n/` (khong phai `sidepanel/`) de **component dung
 * chung** (vd `components/ui/dialog.tsx`) cung dung duoc hook ma khong
 * phai import nguoc tu `sidepanel/`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
