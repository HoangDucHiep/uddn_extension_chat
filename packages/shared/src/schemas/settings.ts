/**
 * Zod schema cho cai dat nguoi dung (FR-SETTINGS-01..07 — T-M1-12).
 *
 * Dat o `packages/shared` de extension, server va eval harness dung chung
 * 1 nguon su that — settings duoc luu trong `chrome.storage.local` cua
 * extension, nhung hinh thuc cua no van phai khop giua moi noi.
 */

import { z } from 'zod'

/** Che do theme — `system` = theo `prefers-color-scheme` cua OS. */
export const themeModeSchema = z.enum(['light', 'dark', 'system'])
export type ThemeMode = z.infer<typeof themeModeSchema>

/** Do mat cua UI (FR-SETTINGS-02). */
export const densitySchema = z.enum(['compact', 'cozy', 'comfortable'])
export type DensityMode = z.infer<typeof densitySchema>

/** Be rong panel (FR-SETTINGS-02 + FR-UX-06). */
export const panelWidthSchema = z.enum(['narrow', 'default', 'wide'])
export type PanelWidth = z.infer<typeof panelWidthSchema>

/** Ngon ngu UI (FR-SETTINGS-06). */
export const uiLanguageSchema = z.enum(['vi', 'en'])
export type UiLanguage = z.infer<typeof uiLanguageSchema>

/**
 * Do phong font — chi nhan cac muc co dinh.
 *
 * Dung enum (khong phai `number`) de tranh "font scale 1.37" tu storage
 * → gia tri khong map duoc ve token hop le.
 */
export const fontScaleSchema = z.union([
  z.literal(0.9),
  z.literal(1),
  z.literal(1.1),
  z.literal(1.2),
])
export type FontScale = z.infer<typeof fontScaleSchema>

/** Cai dat nguoi dung cua extension. */
export const settingsSchema = z.object({
  /** Theme UI (FR-SETTINGS-01). */
  theme: themeModeSchema,
  /** Do phong font (FR-SETTINGS-02). */
  fontScale: fontScaleSchema,
  /** Do mat UI (FR-SETTINGS-02). */
  density: densitySchema,
  /** Be rong panel (FR-SETTINGS-02 + FR-UX-06). */
  panelWidth: panelWidthSchema,
  /** Telemetry (FR-SETTINGS-04) — mac dinh **OFF**. */
  telemetryEnabled: z.boolean(),
  /** Dung lich su chat (FR-SETTINGS-04) — mac dinh **OFF**. */
  historyEnabled: z.boolean(),
  /** Ngon ngu UI (FR-SETTINGS-06). */
  uiLanguage: uiLanguageSchema,
  /** Endpoint BFF (FR-SETTINGS-05). */
  bffUrl: z.string().min(1).max(500),
})
export type Settings = z.infer<typeof settingsSchema>

/** Patch cai dat (chi cho phep doi cac field da biet). */
export const settingsPatchSchema = settingsSchema.partial()
export type SettingsPatch = z.infer<typeof settingsPatchSchema>
