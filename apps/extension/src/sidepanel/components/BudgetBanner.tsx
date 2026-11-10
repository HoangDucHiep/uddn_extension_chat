import { AlertTriangle, CircleAlert } from 'lucide-react'
import type { BudgetStatus } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { formatCostUsd } from '@/lib/costFormat'

/**
 * Banner trang thai **budget cap** (T-M2-03b — FR-PROVIDER-06).
 *
 * Hien thi duoi header (cung vi tri voi banner offline — T-M1-19):
 *  - `warning` → dung token `--warning` (da vuot nguong canh bao).
 *  - `exceeded` → dung token `--danger` (da vuot han muc → luot chat moi bi chan).
 *
 * Khong render khi budget **tat** hoac con duoi nguong canh bao.
 * Khong hardcode mau — chi dung design token.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7 · docs/SYSTEM_DESIGN.md §7.24
 */
export interface BudgetBannerProps {
  /** Trang thai budget hien tai. */
  status: BudgetStatus | undefined
  /** Mo drawer Settings (de user doi han muc). */
  onOpenSettings?: (() => void) | undefined
}

export function BudgetBanner({ status, onOpenSettings }: BudgetBannerProps) {
  const { t } = useI18n()

  if (status === undefined) return null
  if (status.state !== 'warning' && status.state !== 'exceeded') return null

  const isExceeded = status.state === 'exceeded'
  const spent = formatCostUsd(status.spentUsd)
  const limit = formatCostUsd(status.limitUsd)
  const percent = Math.round(status.percentUsed)

  const message = isExceeded
    ? t('budget.banner.exceeded', {
        spent: spent.length > 0 ? spent : '0',
        limit: limit.length > 0 ? limit : '0',
      })
    : t('budget.banner.warning', { percent: String(percent) })

  const Icon = isExceeded ? CircleAlert : AlertTriangle

  return (
    <div
      className={[
        'flex items-center gap-2 border-b bg-[var(--surface-raised)] px-[var(--space-3)] py-[var(--space-1)]',
        'text-[length:var(--font-size-sm)]',
        isExceeded ? 'border-[var(--danger)] text-[var(--danger)]' : 'border-[var(--warning)] text-[var(--warning)]',
      ].join(' ')}
      role="status"
      aria-live="polite"
      data-testid="budget-banner"
      data-budget-state={status.state}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onOpenSettings !== undefined ? (
        <button
          type="button"
          onClick={onOpenSettings}
          className="rounded-[var(--radius-sm)] px-2 py-0.5 text-[length:var(--font-size-xs)] underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="budget-banner-settings"
        >
          {t('budget.banner.openSettings')}
        </button>
      ) : null}
    </div>
  )
}
