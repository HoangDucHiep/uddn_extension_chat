import { describe, expect, it } from 'vitest'
import {
  densitySchema,
  fontScaleSchema,
  panelWidthSchema,
  settingsSchema,
  themeModeSchema,
  uiLanguageSchema,
} from '../src/schemas/settings.js'

/**
 * Test schema cai dat (FR-SETTINGS-01..07 — T-M1-12).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

/** Cai dat hop le mau. */
const validSettings = {
  theme: 'system',
  fontScale: 1,
  density: 'cozy',
  panelWidth: 'default',
  telemetryEnabled: false,
  historyEnabled: false,
  uiLanguage: 'vi',
  bffUrl: 'http://127.0.0.1:8787',
} as const

describe('themeModeSchema', () => {
  it('accept light/dark/system', () => {
    expect(themeModeSchema.safeParse('light').success).toBe(true)
    expect(themeModeSchema.safeParse('dark').success).toBe(true)
    expect(themeModeSchema.safeParse('system').success).toBe(true)
  })

  it('reject gia tri khac', () => {
    expect(themeModeSchema.safeParse('sepia').success).toBe(false)
  })
})

describe('densitySchema', () => {
  it('accept compact/cozy/comfortable', () => {
    expect(densitySchema.safeParse('compact').success).toBe(true)
    expect(densitySchema.safeParse('cozy').success).toBe(true)
    expect(densitySchema.safeParse('comfortable').success).toBe(true)
  })

  it('reject gia tri khac', () => {
    expect(densitySchema.safeParse('roomy').success).toBe(false)
  })
})

describe('panelWidthSchema', () => {
  it('accept narrow/default/wide', () => {
    expect(panelWidthSchema.safeParse('narrow').success).toBe(true)
    expect(panelWidthSchema.safeParse('default').success).toBe(true)
    expect(panelWidthSchema.safeParse('wide').success).toBe(true)
  })

  it('reject gia tri khac', () => {
    expect(panelWidthSchema.safeParse('huge').success).toBe(false)
  })
})

describe('uiLanguageSchema', () => {
  it('accept vi/en', () => {
    expect(uiLanguageSchema.safeParse('vi').success).toBe(true)
    expect(uiLanguageSchema.safeParse('en').success).toBe(true)
  })

  it('reject gia tri khac', () => {
    expect(uiLanguageSchema.safeParse('fr').success).toBe(false)
  })
})

describe('fontScaleSchema', () => {
  it('chi accept 4 muc co dinh', () => {
    expect(fontScaleSchema.safeParse(0.9).success).toBe(true)
    expect(fontScaleSchema.safeParse(1).success).toBe(true)
    expect(fontScaleSchema.safeParse(1.1).success).toBe(true)
    expect(fontScaleSchema.safeParse(1.2).success).toBe(true)
  })

  it('reject he so khong hop le', () => {
    expect(fontScaleSchema.safeParse(1.37).success).toBe(false)
    expect(fontScaleSchema.safeParse(0).success).toBe(false)
    expect(fontScaleSchema.safeParse('1.1').success).toBe(false)
  })
})

describe('settingsSchema', () => {
  it('accept cai dat hop le', () => {
    expect(settingsSchema.safeParse(validSettings).success).toBe(true)
  })

  it('reject khi thieu field', () => {
    const { theme: _theme, ...rest } = validSettings
    expect(settingsSchema.safeParse(rest).success).toBe(false)
  })

  it('reject theme sai', () => {
    expect(settingsSchema.safeParse({ ...validSettings, theme: 'neon' }).success).toBe(false)
  })

  it('reject bffUrl rong', () => {
    expect(settingsSchema.safeParse({ ...validSettings, bffUrl: '' }).success).toBe(false)
  })

  it('reject telemetry khong phai boolean', () => {
    expect(
      settingsSchema.safeParse({ ...validSettings, telemetryEnabled: 'yes' }).success,
    ).toBe(false)
  })
})
