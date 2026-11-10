import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { BudgetStatus } from '@sidekick/shared'

const { BudgetBanner } = await import('../src/sidepanel/components/BudgetBanner')

/**
 * Unit test cho `BudgetBanner` (T-M2-03b — FR-PROVIDER-06).
 *
 * Kiem chung: `warning` → token `--warning`, `exceeded` → token `--danger`,
 * budget tat → KHONG render.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7 · docs/SYSTEM_DESIGN.md §7.24
 */

/**
 * Tao status budget hop le.
 *
 * @param overrides - Field ghi de.
 */
function makeStatus(overrides: Partial<BudgetStatus> = {}): BudgetStatus {
  return {
    settings: {
      enabled: true,
      limitUsd: 10,
      period: 'monthly',
      warnThresholdPercent: 80,
      hardBlock: true,
    },
    spentUsd: 8,
    limitUsd: 10,
    remainingUsd: 2,
    percentUsed: 80,
    state: 'warning',
    period: 'monthly',
    periodStart: '2026-11-01T00:00:00.000Z',
    periodEnd: '2026-12-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('BudgetBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('warning → banner dung token --warning', () => {
    render(<BudgetBanner status={makeStatus({ state: 'warning' })} />)

    const banner = screen.getByTestId('budget-banner')
    expect(banner.getAttribute('data-budget-state')).toBe('warning')
    expect(banner.className).toContain('var(--warning)')
    expect(banner.className).not.toContain('var(--danger)')
  })

  it('exceeded → banner dung token --danger', () => {
    render(
      <BudgetBanner
        status={makeStatus({ state: 'exceeded', spentUsd: 12, remainingUsd: 0, percentUsed: 120 })}
      />,
    )

    const banner = screen.getByTestId('budget-banner')
    expect(banner.getAttribute('data-budget-state')).toBe('exceeded')
    expect(banner.className).toContain('var(--danger)')
  })

  it('state ok / disabled → KHONG render banner', () => {
    const { rerender } = render(<BudgetBanner status={makeStatus({ state: 'ok' })} />)
    expect(screen.queryByTestId('budget-banner')).toBeNull()

    rerender(<BudgetBanner status={makeStatus({ state: 'disabled' })} />)
    expect(screen.queryByTestId('budget-banner')).toBeNull()
  })

  it('chua co status → KHONG render banner', () => {
    render(<BudgetBanner status={undefined} />)
    expect(screen.queryByTestId('budget-banner')).toBeNull()
  })

  it('bam nut "Mo cai dat" → goi callback', () => {
    const onOpenSettings = vi.fn()
    render(<BudgetBanner status={makeStatus({ state: 'exceeded' })} onOpenSettings={onOpenSettings} />)

    fireEvent.click(screen.getByTestId('budget-banner-settings'))
    expect(onOpenSettings).toHaveBeenCalled()
  })
})
