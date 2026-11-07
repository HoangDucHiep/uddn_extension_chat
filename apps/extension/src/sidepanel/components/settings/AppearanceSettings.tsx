import type { DensityMode, FontScale, PanelWidth } from '@sidekick/shared'
import { RadioGroup, SettingsSection, type RadioOption } from './SettingsControls'

/**
 * Section hinh dang (FR-SETTINGS-02 + FR-UX-06 — T-M1-12).
 *
 * - Co chu → bien `--font-scale` tren `<html>`.
 * - Do mat → bien `--density-scale`.
 * - Be rong panel → bien `--panel-max-width`.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface AppearanceSettingsProps {
  /** He so co chu. */
  fontScale: FontScale
  /** Do mat UI. */
  density: DensityMode
  /** Be rong panel. */
  panelWidth: PanelWidth
  /** Doi co chu. */
  onFontScaleChange: (scale: FontScale) => void
  /** Doi do mat. */
  onDensityChange: (density: DensityMode) => void
  /** Doi be rong. */
  onPanelWidthChange: (width: PanelWidth) => void
}

const FONT_OPTIONS: readonly RadioOption<string>[] = [
  { value: '0.9', label: 'Nhỏ' },
  { value: '1', label: 'Vừa' },
  { value: '1.1', label: 'Lớn' },
  { value: '1.2', label: 'Rất lớn' },
]

const DENSITY_OPTIONS: readonly RadioOption<DensityMode>[] = [
  { value: 'compact', label: 'Gọn' },
  { value: 'cozy', label: 'Vừa' },
  { value: 'comfortable', label: 'Rộng rãi' },
]

const WIDTH_OPTIONS: readonly RadioOption<PanelWidth>[] = [
  { value: 'narrow', label: 'Hẹp', description: 'Tối đa 400px.' },
  { value: 'default', label: 'Vừa', description: 'Tối đa 640px.' },
  { value: 'wide', label: 'Rộng', description: 'Tối đa 960px.' },
]

export function AppearanceSettings({
  fontScale,
  density,
  panelWidth,
  onFontScaleChange,
  onDensityChange,
  onPanelWidthChange,
}: AppearanceSettingsProps) {
  return (
    <SettingsSection title="Hiển thị" description="Cỡ chữ, độ mật độ và bề rộng của panel.">
      <RadioGroup
        label="Cỡ chữ"
        value={String(fontScale)}
        options={FONT_OPTIONS}
        onChange={(value) => {
          const parsed = Number(value) as FontScale
          onFontScaleChange(parsed)
        }}
        testId="settings-font-scale"
      />
      <RadioGroup
        label="Mật độ"
        value={density}
        options={DENSITY_OPTIONS}
        onChange={onDensityChange}
        testId="settings-density"
      />
      <RadioGroup
        label="Bề rộng panel"
        value={panelWidth}
        options={WIDTH_OPTIONS}
        onChange={onPanelWidthChange}
        testId="settings-panel-width"
      />
      <p className="px-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
        Bề rộng thực tế còn phụ thuộc khoảng bề rộng bạn đã kéo trong Chrome.
      </p>
    </SettingsSection>
  )
}
