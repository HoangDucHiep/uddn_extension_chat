import { useI18n } from '@/sidepanel/hooks/useI18n'
import { formatCostUsd } from '@/lib/costFormat'

/**
 * Badge token + chi phi cua 1 luot chat (T-M2-03 — FR-PROVIDER-05).
 *
 * Hien thi o dong meta cua bubble assistant:
 *  - token vao / token ra,
 *  - chi phi USD (uoc luong theo bang gia token).
 *
 * Chi phi 0 (provider local: mock / ollama) → chi hien thi token.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.23
 */
export interface UsageBadgeProps {
  /** Token input cua luot. */
  tokensIn?: number | undefined
  /** Token output cua luot. */
  tokensOut?: number | undefined
  /** Chi phi USD cua luot (uoc luong). */
  costUsd?: number | undefined
}

/**
 * Badge hien thi token + chi phi.
 *
 * @param props - Props cua badge.
 */
export function UsageBadge({ tokensIn, tokensOut, costUsd }: UsageBadgeProps) {
  const { t } = useI18n()

  const hasTokens = tokensIn !== undefined || tokensOut !== undefined
  if (!hasTokens) return null

  const inTokens = tokensIn ?? 0
  const outTokens = tokensOut ?? 0
  const cost = formatCostUsd(costUsd)

  if (cost.length === 0) {
    return (
      <span
        className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
        data-testid="usage-badge"
      >
        {t('usage.badge', { tokensIn: String(inTokens), tokensOut: String(outTokens) })}
      </span>
    )
  }

  return (
    <span
      className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
      data-testid="usage-badge"
      data-cost-usd={costUsd}
    >
      {t('usage.badgeCost', {
        tokensIn: String(inTokens),
        tokensOut: String(outTokens),
        cost: t('usage.costUsd', { amount: cost }),
      })}
    </span>
  )
}
