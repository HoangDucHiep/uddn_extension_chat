import type { ContextBudgetResult } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Meter ngan sach context — "Da dung X / Y token".
 *
 * FR-CONTEXT-07: nguoi dung phai biet context bi cat bot khi nao.
 * Nguyen tac: mau theo design token, trang thai co icon + chu (khong chi
 * dua vao mau — WCAG 2.2 §5.1.3).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
 */

/** Nguong chuyen mau (theo phan tram ngan sach da dung). */
const WARNING_RATIO = 0.7
const DANGER_RATIO = 0.9

export interface ContextBudgetProps {
  /** Ket qua tinh ngan sach — `undefined` khi khong co context. */
  budget: ContextBudgetResult | undefined
}

/** Format token gọn: 1.2k / 12k. */
function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`
}

/**
 * Chon token mau + nhan theo ty le da dung.
 */
function toneFor(ratio: number): { fg: string; bg: string } {
  if (ratio > DANGER_RATIO) {
    return { fg: 'var(--danger)', bg: 'var(--danger-subtle)' }
  }
  if (ratio >= WARNING_RATIO) {
    return { fg: 'var(--warning)', bg: 'var(--warning-subtle)' }
  }
  return { fg: 'var(--success)', bg: 'var(--success-subtle)' }
}

/**
 * Meter ngan sach context.
 *
 * Khong render khi khong co context (khong co item dinh kem).
 */
export function ContextBudget({ budget }: ContextBudgetProps) {
  const { t } = useI18n()

  if (budget === undefined) return null

  const ratio = budget.maxTokens === 0 ? 0 : budget.usedTokens / budget.maxTokens
  const tone = toneFor(ratio)
  const percent = Math.min(100, Math.round(ratio * 100))

  return (
    <div
      className="flex items-center gap-2 px-[var(--space-3)] py-[var(--space-1)] text-[length:var(--font-size-xs)]"
      data-testid="context-budget"
      data-percent={percent}
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-[2px]"
        style={{ color: tone.fg, backgroundColor: tone.bg }}
      >
        <span aria-hidden="true">●</span>
        {t('context.budgetUsed', {
          used: formatTokens(budget.usedTokens),
          total: formatTokens(budget.maxTokens),
        })}
      </span>

      {budget.droppedItems > 0 && (
        <span
          className="text-[var(--text-tertiary)]"
          data-testid="context-budget-dropped"
        >
          {t('context.budgetDropped', { count: budget.droppedItems })}
        </span>
      )}

      {budget.items.some((item) => item.truncated) && (
        <span
          className="text-[var(--text-tertiary)]"
          data-testid="context-budget-truncated"
        >
          {t('context.budgetTruncated')}
        </span>
      )}
    </div>
  )
}
