import type { UiLanguage } from '@sidekick/shared'
import { RadioGroup, SettingsSection, type RadioOption } from './SettingsControls'

/**
 * Section ngon ngu (FR-SETTINGS-06 — T-M1-12).
 *
 * Task nay chi **luu lua chon**; viec dich toan bo UI la T-M1-17 (i18n)
 * → ghi ro trong UI de khong nham la da hoan tat.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface LanguageSettingsProps {
  /** Ngon ngu dang chon. */
  uiLanguage: UiLanguage
  /** Doi ngon ngu. */
  onChange: (language: UiLanguage) => void
}

const OPTIONS: readonly RadioOption<UiLanguage>[] = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
]

export function LanguageSettings({ uiLanguage, onChange }: LanguageSettingsProps) {
  return (
    <SettingsSection title="Ngôn ngữ" description="Ngôn ngữ hiển thị của giao diện.">
      <RadioGroup
        label="Ngôn ngữ"
        value={uiLanguage}
        options={OPTIONS}
        onChange={onChange}
        testId="settings-language"
      />
      <p className="px-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
        Giao diện hiện vẫn dùng tiếng Việt. Chuyển ngôn ngữ toàn diện sẽ có ở bản cập nhật sau.
      </p>
    </SettingsSection>
  )
}
