import type { UiLanguage } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { RadioGroup, SettingsSection, type RadioOption } from './SettingsControls'

/**
 * Section ngon ngu (FR-SETTINGS-06 — T-M1-12, dich UI T-M1-17).
 *
 * T-M1-17 xong: chon ngon ngu → **toan bo UI doi ngay**, khong can reload
 * (`I18nProvider` boc ca panel, doc `settings.uiLanguage`).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface LanguageSettingsProps {
  /** Ngon ngu dang chon. */
  uiLanguage: UiLanguage
  /** Doi ngon ngu. */
  onChange: (language: UiLanguage) => void
}

export function LanguageSettings({ uiLanguage, onChange }: LanguageSettingsProps) {
  const { t } = useI18n()

  // Ten ngon ngu giu nguyen tieng goc ("Tiếng Việt" / "English") — quy uoc
  // chung cua moi UI da nua, dung khi ca 2 deu la bang chu Latin.
  const options: readonly RadioOption<UiLanguage>[] = [
    { value: 'vi', label: t('settings.language.vi') },
    { value: 'en', label: t('settings.language.en') },
  ]

  return (
    <SettingsSection title={t('settings.language.title')} description={t('settings.language.description')}>
      <RadioGroup
        label={t('settings.language.label')}
        value={uiLanguage}
        options={options}
        onChange={onChange}
        testId="settings-language"
      />
    </SettingsSection>
  )
}
