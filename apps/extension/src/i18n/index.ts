import type { UiLanguage } from '@sidekick/shared'
import { enDictionary } from './en.js'
import { viDictionary, type Dictionary, type TranslationKey } from './vi.js'

/**
 * Module i18n — nguon su that cho viec dich UI (FR-SETTINGS-06 — T-M1-17).
 *
 * - `viDictionary` la nguon su truth cua **danh sach key** → thieu key se loi
 *   typecheck (`en.ts` kieu `Dictionary`).
 * - `getDictionary()` tra dictionary theo ngon ngu.
 * - `formatMessage()` thay the placeholder `{name}` trong chuoi.
 *
 * Khong dung thu vien i18n (khong `i18next`, khong `intl-messageformat`) →
 * giu bundle nho + khong them dependency.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

export type { Dictionary, TranslationKey }

/** Dictionary theo ngon ngu. */
const DICTIONARIES: Record<UiLanguage, Dictionary> = {
  vi: viDictionary,
  en: enDictionary,
}

/**
 * Tra dictionary theo ngon ngu.
 *
 * Ngon ngu khong hop le → fallback sang tieng Viet (mac dinh an toan).
 *
 * @param language - Ngon ngu can lay.
 */
export function getDictionary(language: UiLanguage): Dictionary {
  return DICTIONARIES[language] ?? viDictionary
}

/**
 * Chuan hoa gia tri ngon ngu (vd tu storage / query string).
 *
 * Gia tri khong hop le → tra `undefined` de caller tu fallback.
 *
 * @param value - Gia tri can chuan hoa.
 */
export function resolveLanguage(value: unknown): UiLanguage | undefined {
  return value === 'vi' || value === 'en' ? value : undefined
}

/**
 * Thay the placeholder `{name}` trong chuoi dich.
 *
 * Placeholder khong co trong `params` → giu nguyen `{name}` (khong lam vỡ UI).
 *
 * @param template - Chuoi co placeholder.
 * @param params - Gia tri thay the.
 */
export function formatMessage(
  template: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/**
 * Tao ham dich cho 1 ngon ngu.
 *
 * Key la nguon su that → goi key sai la **loi compile-time** (neu dung
 * literal). Key la bien → tra chinh key do (khong nem loi) de UI khong vỡ.
 *
 * @param language - Ngon ngu cua dictionary.
 */
export function createTranslator(language: UiLanguage): (
  key: TranslationKey,
  params?: Readonly<Record<string, string | number>>,
) => string {
  const dictionary = getDictionary(language)
  return (key, params) => {
    const template = dictionary[key]
    if (template === undefined) return key
    return formatMessage(template, params)
  }
}
