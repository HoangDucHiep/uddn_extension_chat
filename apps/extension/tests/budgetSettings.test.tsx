import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const fetchBudgetStatusMock = vi.fn()
const updateBudgetSettingsMock = vi.fn()

vi.mock('@/lib/budgetClient', () => ({
  fetchBudgetStatus: (...args: unknown[]) => fetchBudgetStatusMock(...args),
  updateBudgetSettings: (...args: unknown[]) => updateBudgetSettingsMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const { BudgetSettings } = await import(
  '../src/sidepanel/components/settings/BudgetSettings'
)

/**
 * Unit test cho section "Ngan sach chi phi" (T-M2-03b — FR-PROVIDER-06).
 *
 * Kiem chung: cau hinh luu **phia server** qua `PUT /api/budget`; loi API
 * chi hien inline, KHONG crash drawer.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

/** Status budget hop le (dung chung cho cac test). */
function makeStatus(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    settings: {
      enabled: true,
      limitUsd: 10,
      period: 'monthly',
      warnThresholdPercent: 80,
      hardBlock: true,
    },
    spentUsd: 4,
    limitUsd: 10,
    remainingUsd: 6,
    percentUsed: 40,
    state: 'ok',
    period: 'monthly',
    periodStart: '2026-11-01T00:00:00.000Z',
    periodEnd: '2026-12-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('BudgetSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('render section + nap cau hinh tu server', async () => {
    fetchBudgetStatusMock.mockResolvedValue(makeStatus())

    render(<BudgetSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-limit')).toBeTruthy()
    })
    const limit = screen.getByTestId('budget-settings-limit') as HTMLInputElement
    expect(limit.value).toBe('10')
    expect(screen.getByTestId('budget-settings-enabled')).toBeTruthy()
  })

  it('bam "Luu" → goi PUT voi cau hinh da sua', async () => {
    fetchBudgetStatusMock.mockResolvedValue(makeStatus())
    updateBudgetSettingsMock.mockResolvedValue(makeStatus())

    render(<BudgetSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-limit')).toBeTruthy()
    })

    const limit = screen.getByTestId('budget-settings-limit') as HTMLInputElement
    fireEvent.change(limit, { target: { value: '25' } })

    fireEvent.click(screen.getByTestId('budget-settings-save'))

    await waitFor(() => {
      expect(updateBudgetSettingsMock).toHaveBeenCalled()
    })
    const payload = updateBudgetSettingsMock.mock.calls.at(-1)?.[0] as {
      limitUsd: number
      enabled: boolean
    }
    expect(payload.limitUsd).toBe(25)
    expect(payload.enabled).toBe(true)
  })

  it('doi ky tinh → radio daily duoc chon', async () => {
    fetchBudgetStatusMock.mockResolvedValue(makeStatus())
    updateBudgetSettingsMock.mockResolvedValue(makeStatus())

    render(<BudgetSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-period')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('radio-daily'))

    await waitFor(() => {
      expect((screen.getByTestId('radio-daily') as HTMLInputElement).checked).toBe(true)
    })
  })

  it('API loi khi nap → hien loi inline, KHONG crash', async () => {
    fetchBudgetStatusMock.mockRejectedValue(new Error('network'))

    render(<BudgetSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-error')).toBeTruthy()
    })
    expect(screen.getByTestId('budget-settings-save')).toBeTruthy()
  })

  it('API loi khi luu → hien loi inline, KHONG crash', async () => {
    fetchBudgetStatusMock.mockResolvedValue(makeStatus())
    updateBudgetSettingsMock.mockRejectedValue(new Error('network'))

    render(<BudgetSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-save')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('budget-settings-save'))

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-error')).toBeTruthy()
    })
  })

  it('han muc am → khong goi API (validate o client)', async () => {
    fetchBudgetStatusMock.mockResolvedValue(makeStatus())
    updateBudgetSettingsMock.mockResolvedValue(makeStatus())

    render(<BudgetSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-limit')).toBeTruthy()
    })

    const limit = screen.getByTestId('budget-settings-limit') as HTMLInputElement
    fireEvent.change(limit, { target: { value: '-3' } })
    fireEvent.click(screen.getByTestId('budget-settings-save'))

    await waitFor(() => {
      expect(screen.getByTestId('budget-settings-error')).toBeTruthy()
    })
    expect(updateBudgetSettingsMock).not.toHaveBeenCalled()
  })
})
