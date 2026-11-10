import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const fetchUsageMock = vi.fn()

vi.mock('@/lib/usageClient', () => ({
  // Giu nguyen tham so de test kiem tra `from` theo khoang thoi gian.
  fetchUsage: (...args: unknown[]) => fetchUsageMock(...args),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const { UsageSettings } = await import('../src/sidepanel/components/settings/UsageSettings')

/**
 * Unit test cho section "Chi phi & su dung" (T-M2-03 — FR-PROVIDER-05).
 *
 * Kiem chung: response sai shape **khong** lam crash UI (regression do
 * E2E `i18n.spec.ts` stub `/api/**` bang `{ items: [] }`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.23
 */

describe('UsageSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hien thi tong token + chi phi khi response hop le', async () => {
    fetchUsageMock.mockResolvedValue({
      totalTokens: 4655,
      totalCostUsd: 0.00274,
      byDay: [
        {
          date: '2026-11-09',
          tokensIn: 237,
          tokensOut: 492,
          totalTokens: 729,
          costUsd: 0.000405,
          requests: 7,
        },
      ],
    })

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-total-tokens')).toBeTruthy()
    })
    expect(screen.getByTestId('usage-total-tokens').textContent).toContain('4,655')
    expect(screen.getByTestId('usage-total-cost').textContent).toContain('$0.0027')
    expect(screen.getByTestId('usage-by-day')).toBeTruthy()
  })

  it('response sai shape → hien loi, KHONG crash', async () => {
    fetchUsageMock.mockResolvedValue({ items: [] })

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-settings-error')).toBeTruthy()
    })
    expect(screen.queryByTestId('usage-total-tokens')).toBeNull()
  })

  it('API loi → hien loi, KHONG crash', async () => {
    fetchUsageMock.mockRejectedValue(new Error('network'))

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-settings-error')).toBeTruthy()
    })
  })

  it('khong co du lieu → hien thong bao "chua co luot chat"', async () => {
    fetchUsageMock.mockResolvedValue({ totalTokens: 0, totalCostUsd: 0, byDay: [] })

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-settings-empty')).toBeTruthy()
    })
  })

  it('co bo chon khoang thoi gian (mac dinh 7 ngay)', async () => {
    fetchUsageMock.mockResolvedValue({ totalTokens: 0, totalCostUsd: 0, byDay: [] })

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-settings-ranges')).toBeTruthy()
    })
    expect(screen.getByTestId('usage-settings-range-7d').getAttribute('aria-pressed')).toBe('true')
  })

  it('doi khoang → goi API voi `from` tuong ung', async () => {
    fetchUsageMock.mockResolvedValue({ totalTokens: 0, totalCostUsd: 0, byDay: [] })

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-settings-ranges')).toBeTruthy()
    })

    const callCountBefore = fetchUsageMock.mock.calls.length

    fireEvent.click(screen.getByTestId('usage-settings-range-today'))
    await waitFor(() => {
      expect(fetchUsageMock.mock.calls.length).toBeGreaterThan(callCountBefore)
    })

    const lastCall = fetchUsageMock.mock.calls.at(-1)
    const rangeArg = lastCall?.[0] as { from?: string } | undefined
    expect(rangeArg?.from).toBeDefined()

    const from = new Date(rangeArg?.from ?? '')
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    expect(from.getTime()).toBe(startOfToday.getTime())
  })

  it('khoang "all" → goi API khong co tham so `from`', async () => {
    fetchUsageMock.mockResolvedValue({ totalTokens: 0, totalCostUsd: 0, byDay: [] })

    render(<UsageSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('usage-settings-ranges')).toBeTruthy()
    })

    const callCountBefore = fetchUsageMock.mock.calls.length

    fireEvent.click(screen.getByTestId('usage-settings-range-all'))

    await waitFor(() => {
      expect(fetchUsageMock.mock.calls.length).toBeGreaterThan(callCountBefore)
    })

    const lastCall = fetchUsageMock.mock.calls.at(-1)
    expect(lastCall?.[0]).toBeUndefined()
  })
})
