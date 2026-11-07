/**
 * Cai dat nguoi dung (FR-SETTINGS-01..07 — T-M1-12).
 *
 * Luu trong `chrome.storage.local` duoi key `sidekick.settings` — dung
 * `settingsSchema` cua `packages/shared` de validate (1 nguon su that cho
 * extension / server / eval).
 *
 * File nay **thuan** (chi dung `chrome.*`) de test duoc trong jsdom.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

import {
  densitySchema,
  fontScaleSchema,
  panelWidthSchema,
  settingsSchema,
  themeModeSchema,
  uiLanguageSchema,
  type DensityMode,
  type FontScale,
  type PanelWidth,
  type Settings,
  type ThemeMode,
  type UiLanguage,
} from '@sidekick/shared'

/** Khoa storage luu cai dat. */
export const SETTINGS_STORAGE_KEY = 'sidekick.settings'

/**
 * Tien to khoa storage cua Sidekick.
 *
 * Xoá du lieu local (FR-SETTINGS-03) xoa theo prefix nay — nhung **giu**
 * `sidekick.onboarding.*` va `sidekick.preferredProvider` (xem
 * `deleteLocalSidekickData`).
 */
export const SIDEKICK_STORAGE_PREFIX = 'sidekick.'

/** Khoa onboarding — **khong** xoa khi xoa du lieu local. */
export const PRESERVED_STORAGE_KEYS = [
  'sidekick.onboarding.completed',
  'sidekick.preferredProvider',
] as const

/** Cai dat mac dinh. */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontScale: 1,
  density: 'cozy',
  panelWidth: 'default',
  // FR-SETTINGS-04: telemetry OFF, history OFF — bat khi user chu dong bat.
  telemetryEnabled: false,
  historyEnabled: false,
  uiLanguage: 'vi',
  bffUrl: 'http://127.0.0.1:8787',
}

/** Do phong font hop le. */
const FONT_SCALES: readonly FontScale[] = [0.9, 1, 1.1, 1.2]

/**
 * Doc cai dat tu storage.
 *
 * Storage loi / gia tri sai schema → tra `DEFAULT_SETTINGS` (khong throw).
 * Sai mot field → fallback field do, giu cac field con lai.
 */
export async function readSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
    const raw = stored[SETTINGS_STORAGE_KEY]
    if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }

    const parsed = settingsSchema.safeParse(raw)
    if (parsed.success) return parsed.data

    // Sai mot vai field → giu cac field hop le, fallback field sai.
    const record = raw as Record<string, unknown>
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS }
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      const value = record[key]
      if (value !== undefined) merged[key] = value
    }

    // Validate **tung field** de mot field sai khong lam hong field hop le.
    const themeParsed = themeModeSchema.safeParse(merged['theme'])
    const fontParsed = fontScaleSchema.safeParse(merged['fontScale'])
    const densityParsed = densitySchema.safeParse(merged['density'])
    const widthParsed = panelWidthSchema.safeParse(merged['panelWidth'])
    const languageParsed = uiLanguageSchema.safeParse(merged['uiLanguage'])
    const telemetryParsed = typeof merged['telemetryEnabled'] === 'boolean'
    const historyParsed = typeof merged['historyEnabled'] === 'boolean'
    const rawUrl = merged['bffUrl']
    const urlParsed = typeof rawUrl === 'string' && rawUrl.length > 0 && rawUrl.length <= 500

    return {
      theme: themeParsed.success ? themeParsed.data : DEFAULT_SETTINGS.theme,
      fontScale: fontParsed.success ? fontParsed.data : DEFAULT_SETTINGS.fontScale,
      density: densityParsed.success ? densityParsed.data : DEFAULT_SETTINGS.density,
      panelWidth: widthParsed.success ? widthParsed.data : DEFAULT_SETTINGS.panelWidth,
      telemetryEnabled: telemetryParsed
        ? (merged['telemetryEnabled'] as boolean)
        : DEFAULT_SETTINGS.telemetryEnabled,
      historyEnabled: historyParsed
        ? (merged['historyEnabled'] as boolean)
        : DEFAULT_SETTINGS.historyEnabled,
      uiLanguage: languageParsed.success ? languageParsed.data : DEFAULT_SETTINGS.uiLanguage,
      bffUrl: urlParsed ? (rawUrl as string) : DEFAULT_SETTINGS.bffUrl,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Ghi **mot phan** cai dat (merge) vao storage.
 *
 * Merge chay qua schema nen field khong hop le bi bo qua.
 */
export async function writeSettings(patch: Partial<Settings>): Promise<void> {
  try {
    const current = await readSettings()
    const merged = settingsSchema.safeParse({ ...current, ...patch })
    if (!merged.success) return

    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: merged.data })
  } catch {
    // Storage khong ghi duoc → bo qua (state trong RAM van dung).
  }
}

/** Khoi phuc cai dat mac dinh. */
export async function resetSettings(): Promise<void> {
  try {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: { ...DEFAULT_SETTINGS } })
  } catch {
    // Bo qua.
  }
}

/**
 * Quyet dinh theme hien thi tu che do + so chi thieu cua OS.
 *
 * @param mode - Che do user chon.
 * @param prefersDark - OS dang dung nen toi khong.
 */
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

/**
 * Chuyen do phong font thanh chuoi CSS hop le.
 *
 * Gia tri ngoai danh sach → fallback `1`.
 */
export function fontScaleFor(scale: number): string {
  const match = FONT_SCALES.find((item) => item === scale)
  return String(match ?? 1)
}

/**
 * Chuyen be rong panel thanh `max-width` CSS.
 *
 * @param width - Be rong user chon.
 */
export function panelMaxWidthFor(width: PanelWidth): string {
  switch (width) {
    case 'narrow':
      return '400px'
    case 'wide':
      return '960px'
    default:
      return '640px'
  }
}

/**
 * Do mat UI → bien CSS `--density-scale`.
 *
 * Dung `--density-scale` de cac component tu nhan (padding/gap) ma khong
 * phai sua tung component.
 */
export function densityScaleFor(density: DensityMode): string {
  switch (density) {
    case 'compact':
      return '0.85'
    case 'comfortable':
      return '1.15'
    default:
      return '1'
  }
}

/**
 * Xuat cai dat ra chuoi JSON (FR-SETTINGS-07).
 *
 * @returns JSON pretty-print (de user doc/edit duoc).
 */
export async function exportSettings(): Promise<string> {
  const settings = await readSettings()
  return JSON.stringify(settings, null, 2)
}

/**
 * Nhap cai dat tu chuoi JSON (FR-SETTINGS-07).
 *
 * JSON sai / thieu field → nem loi voi thong diep ro rang cho UI hien thi.
 * Thieu field → dung gia tri mac dinh cho field do.
 *
 * @param json - Chuoi JSON nguoi dung chon file.
 */
export async function importSettings(json: string): Promise<Settings> {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(json)
  } catch {
    throw new Error('File khong phai JSON hop le')
  }

  if (typeof parsedJson !== 'object' || parsedJson === null) {
    throw new Error('File khong chua cai dat hop le')
  }

  const merged = { ...DEFAULT_SETTINGS, ...(parsedJson as Record<string, unknown>) }
  const parsed = settingsSchema.safeParse(merged)
  if (!parsed.success) {
    throw new Error('Cai dat trong file khong hop le')
  }

  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: parsed.data })
  return parsed.data
}

/**
 * Xoa **toan bo** du lieu local cua Sidekick (FR-SETTINGS-03 + NFR-SEC-07).
 *
 * Xoa moi khoa co tien to `sidekick.` — giu nguyên trang thai onboarding
 * (`sidekick.onboarding.completed` · `sidekick.preferredProvider`) de user
 * khong bi bat lai onboarding sau khi xoa du lieu.
 *
 * @returns Danh sach khoa da xoa.
 */
export async function deleteLocalSidekickData(): Promise<string[]> {
  try {
    const all = await chrome.storage.local.get(null)
    const keys = Object.keys(all).filter(
      (key) =>
        key.startsWith(SIDEKICK_STORAGE_PREFIX) &&
        !(PRESERVED_STORAGE_KEYS as readonly string[]).includes(key),
    )
    if (keys.length > 0) {
      await chrome.storage.local.remove(keys)
    }
    return keys
  } catch {
    return []
  }
}

/** Re-export de consumer khong phai import tu 2 noi. */
export type { DensityMode, FontScale, PanelWidth, Settings, ThemeMode, UiLanguage }
