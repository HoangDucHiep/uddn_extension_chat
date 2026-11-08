import type { DensityMode, FontScale, PanelWidth } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { RadioGroup, SettingsSection, type RadioOption } from './SettingsControls'

/**
 * Section hinh dang (FR-SETTINGS-02 + FR-UX-06 — T-M1-12, dich UI T-M1-17).
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

export function AppearanceSettings({
  fontScale,
  density,
  panelWidth,
  onFontScaleChange,
  onDensityChange,
  onPanelWidthChange,
}: AppearanceSettingsProps) {
  const { t } = useI18n()

  // Nhan dich tinh trong render → doi ngon ngu ap dung ngay.
  const fontOptions: readonly RadioOption<string>[] = [
    { value: '0.9', label: t('settings.appearance.fontScale.small') },
    { value: '1', label: t('settings.appearance.fontScale.medium') },
    { value: '1.1', label: t('settings.appearance.fontScale.large') },
    { value: '1.2', label: t('settings.appearance.fontScale.veryLarge') },
  ]

  const densityOptions: readonly RadioOption<DensityMode>[] = [
    { value: 'compact', label: t('settings.appearance.density.compact') },
    { value: 'cozy', label: t('settings.appearance.density.cozy') },
    { value: 'comfortable', label: t('settings.appearance.density.comfortable') },
  ]

  const widthOptions: readonly RadioOption<PanelWidth>[] = [
    {
      value: 'narrow',
      label: t('settings.appearance.width.narrow'),
      description: t('settings.appearance.width.narrowDescription'),
    },
    {
      value: 'default',
      label: t('settings.appearance.width.default'),
      description: t('settings.appearance.width.defaultDescription'),
    },
    {
      value: 'wide',
      label: t('settings.appearance.width.wide'),
      description: t('settings.appearance.width.wideDescription'),
    },
  ]

  return (
    <SettingsSection
      title={t('settings.appearance.title')}
      description={t('settings.appearance.description')}
    >
      <RadioGroup
        label={t('settings.appearance.fontSize')}
        value={String(fontScale)}
        options={fontOptions}
        onChange={(value) => {
          const parsed = Number(value) as FontScale
          onFontScaleChange(parsed)
        }}
        testId="settings-font-scale"
      />
      <RadioGroup
        label={t('settings.appearance.density')}
        value={density}
        options={densityOptions}
        onChange={onDensityChange}
        testId="settings-density"
      />
      <RadioGroup
        label={t('settings.appearance.panelWidth')}
        value={panelWidth}
        options={widthOptions}
        onChange={onPanelWidthChange}
        testId="settings-panel-width"
      />
    </SettingsSection>
  )
}
