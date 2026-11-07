import { SettingsSection, ToggleRow } from './SettingsControls'

/**
 * Section quyen rieng tu (FR-SETTINGS-04 — T-M1-12).
 *
 * FR-SETTINGS-04 AC: "mac dinh telemetry OFF, history OFF" → task nay
 * chi **luu co** va hien thi trang thai. Hanh vi telemetry that la
 * T-M2-19 (M2) → ghi ro "chua bat" de khong nói doi user.
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
  return (
    <SettingsSection
      title="Quyền riêng tư"
      description="Mặc định tắt. Tắt cờ giúp bạn kiểm soát dữ liệu được chia sẻ."
    >
      <ToggleRow
        label="Gửi telemetry (số liệu ẩn danh)"
        description="Chưa dùng trong phiên bản này — bật/tắt chỉ lưu lựa chọn của bạn."
        checked={telemetryEnabled}
        onChange={onTelemetryChange}
        testId="settings-telemetry"
      />
      <ToggleRow
        label="Dùng lịch sử chat"
        description="Chưa dùng trong phiên bản này — bật/tắt chỉ lưu lựa chọn của bạn."
        checked={historyEnabled}
        onChange={onHistoryChange}
        testId="settings-history"
      />
    </SettingsSection>
  )
}
