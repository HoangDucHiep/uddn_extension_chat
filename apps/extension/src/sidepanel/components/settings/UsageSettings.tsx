import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { usageResponseSchema, type UsageResponse } from '@sidekick/shared'
import { fetchUsage } from '@/lib/usageClient'
import { formatCostUsd } from '@/lib/costFormat'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { SettingsSection } from './SettingsControls'

/**
 * Section "Chi phi & su dung" trong drawer Settings (T-M2-03 — FR-PROVIDER-05).
 *
 * Hien thi tong token + chi phi uoc luong cua cac luot chat da ghi nhan tren
 * may chu BFF, tach theo ngay. Chi phi la **uoc luong** theo bang gia token
 * (khong phai hoa don).
 *
 * Response duoc validate bang `usageResponseSchema` (nguon su that) → response
 * sai shape (vd server stub trong E2E) khong lam **sập** drawer Settings.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7 · docs/SYSTEM_DESIGN.md §7.23
 */

/** Khoang thoi gian xem thong ke. */
const USAGE_RANGES = ['today', '7d', '30d', 'all'] as const

/** Mot khoang thoi gian xem thong ke. */
type UsageRange = (typeof USAGE_RANGES)[number]

/**
 * Tinh moc thoi gian `from` cho 1 khoang.
 *
 * Server nhan `from`/`to` la ISO 8601 → canh goc ngay (giay) de khong
 * bo qua phan thoi gian trong ngay hien tai.
 *
 * @param range - Khoang da chon.
 * @returns Moc `from` (ISO) hoac `undefined` cho khoang `all`.
 */
function resolveRangeStart(range: UsageRange): string | undefined {
  const now = new Date()

  if (range === 'all') return undefined

  if (range === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.toISOString()
  }

  const days = range === '7d' ? 7 : 30
  const start = new Date(now)
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

export function UsageSettings() {
  const { t } = useI18n()
  const [usage, setUsage] = useState<UsageResponse | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [range, setRange] = useState<UsageRange>('7d')

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setHasError(false)
    try {
      const from = resolveRangeStart(range)
      const response = await fetchUsage(from !== undefined ? { from } : undefined)
      const parsed = usageResponseSchema.safeParse(response)
      if (!parsed.success) {
        // Response sai shape → coi nhu loi (khong lam crash drawer).
        setUsage(undefined)
        setHasError(true)
        return
      }
      setUsage(parsed.data)
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [range])

  // Nap khi section duoc render (drawer mo) hoac khi doi khoang.
  useEffect(() => {
    void load()
  }, [load])

  const totalCost = formatCostUsd(usage?.totalCostUsd)

  return (
    <SettingsSection
      title={t('usage.settings.title')}
      description={t('usage.settings.description')}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label={t('usage.settings.rangeLabel')}
          data-testid="usage-settings-ranges"
        >
          {USAGE_RANGES.map((option) => {
            const isActive = option === range
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option)
                }}
                aria-pressed={isActive}
                className={`rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--font-size-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
                  isActive
                    ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-hover)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]'
                }`}
                data-testid={`usage-settings-range-${option}`}
              >
                {t(`usage.settings.range.${option}`)}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            void load()
          }}
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--font-size-xs)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="usage-settings-refresh"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
          )}
          {t('usage.settings.refresh')}
        </button>
      </div>

      {hasError ? (
        <p className="text-[length:var(--font-size-xs)] text-[var(--danger)]" data-testid="usage-settings-error">
          {t('usage.settings.error')}
        </p>
      ) : null}

      {!isLoading && !hasError && usage !== undefined && usage.byDay.length === 0 ? (
        <p
          className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
          data-testid="usage-settings-empty"
        >
          {t('usage.settings.empty')}
        </p>
      ) : null}

      {usage !== undefined && usage.byDay.length > 0 ? (
        <div className="space-y-2" data-testid="usage-settings-summary">
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-2 py-1.5">
              <dt className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                {t('usage.settings.totalTokens')}
              </dt>
              <dd
                className="text-[length:var(--font-size-sm)] font-semibold text-[var(--text-primary)]"
                data-testid="usage-total-tokens"
              >
                {usage.totalTokens.toLocaleString()}
              </dd>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-2 py-1.5">
              <dt className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                {t('usage.settings.totalCost')}
              </dt>
              <dd
                className="text-[length:var(--font-size-sm)] font-semibold text-[var(--text-primary)]"
                data-testid="usage-total-cost"
              >
                {totalCost.length > 0 ? t('usage.costUsd', { amount: totalCost }) : t('usage.costUsdFree')}
              </dd>
            </div>
          </dl>

          <div>
            <h4 className="text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
              {t('usage.settings.byDay')}
            </h4>
            <ul className="mt-1 space-y-0.5" data-testid="usage-by-day">
              {usage.byDay.map((day) => {
                const dayCost = formatCostUsd(day.costUsd)
                return (
                  <li
                    key={day.date}
                    className="flex items-baseline justify-between gap-2 text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
                  >
                    <span className="truncate font-mono">{day.date}</span>
                    <span className="shrink-0">
                      {t('usage.settings.day', {
                        date: day.date,
                        tokens: day.totalTokens.toLocaleString(),
                        cost:
                          dayCost.length > 0
                            ? t('usage.costUsd', { amount: dayCost })
                            : t('usage.costUsdFree'),
                      })}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </SettingsSection>
  )
}
