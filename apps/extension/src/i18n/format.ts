/**
 * Tien ich dich chuoi — **khong** import dictionary.
 *
 * Tach rieng de `i18n/outsidePanel.ts` (bundle ngoai panel) va `i18n/index.ts`
 * (bundle side panel) dung chung ma khong keo dictionary cua nhau.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

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
 * Chuan hoa gia tri ngon ngu (vd tu storage / query string).
 *
 * Gia tri khong hop le → tra `undefined` de caller tu fallback.
 *
 * @param value - Gia tri can chuan hoa.
 */
export function resolveLanguage(value: unknown): 'vi' | 'en' | undefined {
  return value === 'vi' || value === 'en' ? value : undefined
}
