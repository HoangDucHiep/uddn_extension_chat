/**
 * Ap theme / font-scale / be rong panel len DOM (FR-SETTINGS-01/02 — T-M1-12).
 *
 * Chi doc/ghi **CSS variable** + class tren `<html>` → khong can sua tung
 * component. Design token (`design/tokens.css`) da co san block `.dark`,
 * bien `--font-scale` va `--panel-max-width`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

import type { DensityMode, PanelWidth, ThemeMode } from '@sidekick/shared'
import { densityScaleFor, fontScaleFor, panelMaxWidthFor, resolveTheme } from './settings'

/**
 * Lay trang thai nen toi cua OS.
 *
 * @returns `true` neu OS dang dung nen toi.
 */
export function prefersDarkScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Ap theme len `<html>`.
 *
 * Bat/tat class `.dark` → moi block token trong `design/tokens.css` doi
 * mau. Khong hardcode mau o day.
 *
 * @param mode - Che do user chon.
 * @param prefersDark - OS dang dung nen toi khong.
 */
export function applyTheme(mode: ThemeMode, prefersDark: boolean): void {
  if (typeof document === 'undefined') return

  const resolved = resolveTheme(mode, prefersDark)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.setAttribute('data-theme', resolved)
}

/**
 * Ap do phong font len `<html>`.
 *
 * @param scale - He so font scale.
 */
export function applyFontScale(scale: number): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--font-scale', fontScaleFor(scale))
}

/**
 * Ap do mat UI len `<html>` (bien `--density-scale`).
 *
 * @param density - Do mat user chon.
 */
export function applyDensity(density: DensityMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--density-scale', densityScaleFor(density))
}

/**
 * Ap be rong toi da panel len `<html>`.
 *
 * @param width - Be rong user chon.
 */
export function applyPanelWidth(width: PanelWidth): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--panel-max-width', panelMaxWidthFor(width))
}

/**
 * Lang nghe thay doi nen toi cua OS.
 *
 * Dung khi theme = `system` → OS doi sang nen toi → panel doi ngay.
 *
 * @param onChange - Callback khi nen toi OS doi.
 * @returns Ham huy listener.
 */
export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = (event: MediaQueryListEvent): void => {
    onChange(event.matches)
  }

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => {
      query.removeEventListener('change', listener)
    }
  }

  // Trinh duyet cu — fallback API cu.
  query.addListener(listener)
  return () => {
    query.removeListener(listener)
  }
}
