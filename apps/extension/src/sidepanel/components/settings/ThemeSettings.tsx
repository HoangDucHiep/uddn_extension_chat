import type { ThemeMode } from '@sidekick/shared'
import { RadioGroup, SettingsSection, type RadioOption } from './SettingsControls'

/**
 * Section theme (FR-SETTINGS-01 — T-M1-12).
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

const OPTIONS: readonly RadioOption<ThemeMode>[] = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  {
    value: 'system',
    label: 'Theo hệ điều hành',
    description: 'Tự đổi khi hệ điều hành đổi nền sáng/tối.',
  },
]

export function ThemeSettings({ theme, onChange }: ThemeSettingsProps) {
  return (
    <SettingsSection title="Giao diện" description="Chọn nền sáng hoặc tối cho side panel.">
      <RadioGroup
        label="Theme"
        value={theme}
        options={OPTIONS}
        onChange={onChange}
        testId="settings-theme"
      />
    </SettingsSection>
  )
}
