import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BUDGET_SETTINGS,
  evaluateBudgetState,
  resolveBudgetPeriod,
} from '../src/budget.js'
import {
  budgetSettingsPatchSchema,
  budgetSettingsSchema,
  budgetStatusSchema,
} from '../src/schemas/budget.js'

/**
 * Test cho contract budget cap (T-M2-03b — FR-PROVIDER-06).
 *
 * AC goc: "Server chặn lượt chat mới khi vượt hạn mức" → phần logic
 * quyết định (mốc kỳ + trạng thái) nằm ở `packages/shared` → test ở đây
 * để extension + server dùng chung 1 hành vi.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

describe('resolveBudgetPeriod', () => {
  it('ky daily → bat dau 00:00 hom nay, ket thuc 00:00 ngay mai', () => {
    const now = new Date(2026, 10, 10, 15, 30, 0)
    const { start, end } = resolveBudgetPeriod('daily', now)

    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getDate()).toBe(10)
    expect(end.getDate()).toBe(11)
    expect(end.getHours()).toBe(0)
  })

  it('ky monthly → bat dau 00:00 ngay 1 thang nay', () => {
    const now = new Date(2026, 10, 10, 15, 30, 0)
    const { start, end } = resolveBudgetPeriod('monthly', now)

    expect(start.getDate()).toBe(1)
    expect(start.getMonth()).toBe(10)
    expect(start.getHours()).toBe(0)
    // Thang 12 (thang 11 + 1) → JS tu xu ly thang 13.
    expect(end.getMonth()).toBe(11)
    expect(end.getDate()).toBe(1)
  })

  it('thang 12 → ky monthly dung lai thang 1 nam sau', () => {
    const now = new Date(2026, 11, 25, 8, 0, 0)
    const { start, end } = resolveBudgetPeriod('monthly', now)

    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(11)
    expect(end.getFullYear()).toBe(2027)
    expect(end.getMonth()).toBe(0)
    expect(end.getDate()).toBe(1)
  })
})

describe('evaluateBudgetState', () => {
  it('budget tat → disabled', () => {
    const result = evaluateBudgetState({
      enabled: false,
      limitUsd: 10,
      spentUsd: 5,
      warnThresholdPercent: 80,
    })
    expect(result.state).toBe('disabled')
    expect(result.percentUsed).toBe(0)
  })

  it('han muc = 0 → disabled (khong gioi han)', () => {
    const result = evaluateBudgetState({
      enabled: true,
      limitUsd: 0,
      spentUsd: 5,
      warnThresholdPercent: 80,
    })
    expect(result.state).toBe('disabled')
  })

  it('duoi nguong canh bao → ok', () => {
    const result = evaluateBudgetState({
      enabled: true,
      limitUsd: 10,
      spentUsd: 5,
      warnThresholdPercent: 80,
    })
    expect(result.state).toBe('ok')
    expect(result.percentUsed).toBe(50)
  })

  it('vuot nguong canh bao → warning', () => {
    const result = evaluateBudgetState({
      enabled: true,
      limitUsd: 10,
      spentUsd: 8,
      warnThresholdPercent: 80,
    })
    expect(result.state).toBe('warning')
    expect(result.percentUsed).toBe(80)
  })

  it('vuot han muc → exceeded', () => {
    const result = evaluateBudgetState({
      enabled: true,
      limitUsd: 10,
      spentUsd: 12,
      warnThresholdPercent: 80,
    })
    expect(result.state).toBe('exceeded')
    expect(result.percentUsed).toBe(120)
  })

  it('chi phi am → coi nhu 0', () => {
    const result = evaluateBudgetState({
      enabled: true,
      limitUsd: 10,
      spentUsd: -5,
      warnThresholdPercent: 80,
    })
    expect(result.state).toBe('ok')
    expect(result.percentUsed).toBe(0)
  })
})

describe('budgetSettingsSchema', () => {
  it('accept cai dat hop le', () => {
    const parsed = budgetSettingsSchema.safeParse(DEFAULT_BUDGET_SETTINGS)
    expect(parsed.success).toBe(true)
  })

  it('reject han muc am', () => {
    const parsed = budgetSettingsSchema.safeParse({
      ...DEFAULT_BUDGET_SETTINGS,
      limitUsd: -1,
    })
    expect(parsed.success).toBe(false)
  })

  it('reject ky khong hop le', () => {
    const parsed = budgetSettingsSchema.safeParse({
      ...DEFAULT_BUDGET_SETTINGS,
      period: 'weekly',
    })
    expect(parsed.success).toBe(false)
  })

  it('reject nguong canh bao ngoai 1..100', () => {
    expect(
      budgetSettingsSchema.safeParse({ ...DEFAULT_BUDGET_SETTINGS, warnThresholdPercent: 0 })
        .success,
    ).toBe(false)
    expect(
      budgetSettingsSchema.safeParse({ ...DEFAULT_BUDGET_SETTINGS, warnThresholdPercent: 101 })
        .success,
    ).toBe(false)
  })
})

describe('budgetSettingsPatchSchema', () => {
  it('accept patch rong (doi 1 field)', () => {
    expect(budgetSettingsPatchSchema.safeParse({}).success).toBe(true)
    expect(budgetSettingsPatchSchema.safeParse({ limitUsd: 5 }).success).toBe(true)
  })

  it('reject patch sai kieu du lieu', () => {
    expect(budgetSettingsPatchSchema.safeParse({ enabled: 'co' }).success).toBe(false)
  })
})

describe('budgetStatusSchema', () => {
  it('accept status day du', () => {
    const parsed = budgetStatusSchema.safeParse({
      settings: DEFAULT_BUDGET_SETTINGS,
      spentUsd: 1.5,
      limitUsd: 10,
      remainingUsd: 8.5,
      percentUsed: 15,
      state: 'ok',
      period: 'monthly',
      periodStart: '2026-11-01T00:00:00.000Z',
      periodEnd: '2026-12-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })

  it('reject state khong hop le', () => {
    const parsed = budgetStatusSchema.safeParse({
      settings: DEFAULT_BUDGET_SETTINGS,
      spentUsd: 0,
      limitUsd: 0,
      remainingUsd: 0,
      percentUsed: 0,
      state: 'het-tien',
      period: 'monthly',
      periodStart: '2026-11-01T00:00:00.000Z',
      periodEnd: '2026-12-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
  })
})
