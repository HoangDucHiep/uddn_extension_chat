import { useI18n } from '@/sidepanel/hooks/useI18n'
import { SettingsSection, ToggleRow } from './SettingsControls'

/**
 * Section quyen rieng tu (FR-SETTINGS-04 — T-M1-12, dich UI T-M1-17).
 *
 * FR-SETTINGS-04 AC: "mac dinh telemetry OFF, history OFF" → task nay
 * chi **luu co** va hien thi trang thai. Hanh vi telemetry that la
 * T-M2-19 (M2) → ghi ro "chua bat" de khong noi doi user.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface PrivacySettingsProps {
  /** Telemetry dang bat hay tat. */
  telemetryEnabled: boolean
  /** Dung lich su chat hay khong. */
  historyEnabled: boolean
  /** Doi trang thai telemetry. */
  onTelemetryChange: (enabled: boolean) => void
  /** Doi trang thai history. */
  onHistoryChange: (enabled: boolean) => void
}

export function PrivacySettings({
  telemetryEnabled,
  historyEnabled,
  onTelemetryChange,
  onHistoryChange,
}: PrivacySettingsProps) {
  const { t } = useI18n()

  return (
    <SettingsSection title={t('settings.privacy.title')} description={t('settings.privacy.description')}>
      <ToggleRow
        label={t('settings.privacy.telemetry')}
        description={t('settings.privacy.telemetryDescription')}
        checked={telemetryEnabled}
        onChange={onTelemetryChange}
        testId="settings-telemetry"
      />
      <ToggleRow
        label={t('settings.privacy.history')}
        description={t('settings.privacy.historyDescription')}
        checked={historyEnabled}
        onChange={onHistoryChange}
        testId="settings-history"
      />
    </SettingsSection>
  )
}
