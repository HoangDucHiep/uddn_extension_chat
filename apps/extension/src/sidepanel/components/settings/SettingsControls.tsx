import type { ReactNode } from 'react'

/**
 * Nhom radio de dung chung cho cac section Settings (FR-SETTINGS-01/02/06).
 *
 * Dung **radio native** + `<label>` → a11y tot, khong can them component UI
 * moi (rule coding-standards.mdc: khong cai them thu vien UI khong trao doi).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface RadioOption<T extends string> {
  /** Gia tri duoc luu vao settings. */
  value: T
  /** Nhan hien thi. */
  label: string
  /** Mo ta ngan (duoi nhan) — quang cao. */
  description?: string
}

export interface RadioGroupProps<T extends string> {
  /** Ten nhom — dung cho `fieldset`/`legend` (a11y). */
  label: string
  /** Gia tri dang chon. */
  value: T
  /** Cac lua chon. */
  options: readonly RadioOption<T>[]
  /** Doi gia tri. */
  onChange: (value: T) => void
  /** `data-testid` de test tuong tac. */
  testId?: string
}

/**
 * Nhom radio cua section Settings.
 *
 * @param props - Props cua nhom radio.
 */
export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: RadioGroupProps<T>) {
  return (
    <fieldset className="space-y-1" data-testid={testId}>
      <legend className="mb-1 text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
        {label}
      </legend>
      <div className="space-y-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--surface-sunken)]"
          >
            <input
              type="radio"
              name={label}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value)
              }}
              className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              data-testid={`radio-${option.value}`}
            />
            <span className="min-w-0">
              <span className="block text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
                {option.label}
              </span>
              {option.description !== undefined ? (
                <span className="block text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Toggle (checkbox) cho cac setting bat/tat (FR-SETTINGS-04).
 */
export interface ToggleRowProps {
  /** Nhan. */
  label: string
  /** Mo ta ngan. */
  description?: string
  /** Dang bat hay tat. */
  checked: boolean
  /** Doi trang thai. */
  onChange: (checked: boolean) => void
  /** `data-testid`. */
  testId?: string
}

/**
 * 1 dong toggle.
 *
 * @param props - Props cua dong toggle.
 */
export function ToggleRow({ label, description, checked, onChange, testId }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-[var(--radius-md)] px-2 py-1.5 hover:bg-[var(--surface-sunken)]">
      <span className="min-w-0">
        <span className="block text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
          {label}
        </span>
        {description !== undefined ? (
          <span className="block text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            {description}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked)
        }}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        data-testid={testId}
      />
    </label>
  )
}

/**
 * Wrapper 1 section trong drawer Settings.
 */
export interface SettingsSectionProps {
  /** Tieu de section. */
  title: string
  /** Mo ta ngan duoi tieu de. */
  description?: string
  /** Noi dung section. */
  children: ReactNode
}

/**
 * 1 section trong drawer Settings.
 *
 * @param props - Props cua section.
 */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <section className="space-y-2 border-b border-[var(--border-subtle)] pb-4 last:border-b-0">
      <div>
        <h3 className="text-[length:var(--font-size-sm)] font-semibold text-[var(--text-primary)]">
          {title}
        </h3>
        {description !== undefined ? (
          <p className="mt-0.5 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
