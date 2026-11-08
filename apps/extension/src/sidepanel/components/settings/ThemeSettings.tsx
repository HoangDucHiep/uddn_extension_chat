import type { ThemeMode } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { RadioGroup, SettingsSection, type RadioOption } from './SettingsControls'

/**
 * Section theme (FR-SETTINGS-01 — T-M1-12, dich UI T-M1-17).
 *
 * Theme `system` theo `prefers-color-scheme` cua OS; 2 mode con lai la
 * lua chon cua user.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface ThemeSettingsProps {
  /** Theme dang chon. */
  theme: ThemeMode
  /** Doi theme. */
  onChange: (theme: ThemeMode) => void
}

export function ThemeSettings({ theme, onChange }: ThemeSettingsProps) {
  const { t } = useI18n()

  // Nhan dich phai tinh trong render → phai tao trong component (khong phai
  // constant cap module) de doi ngon ngu ap dung ngay.
  const options: readonly RadioOption<ThemeMode>[] = [
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
    {
      value: 'system',
      label: t('settings.theme.system'),
      description: t('settings.theme.systemDescription'),
    },
  ]

  return (
    <SettingsSection title={t('settings.theme.title')} description={t('settings.theme.description')}>
      <RadioGroup
        label={t('settings.theme.label')}
        value={theme}
        options={options}
        onChange={onChange}
        testId="settings-theme"
      />
    </SettingsSection>
  )
}
