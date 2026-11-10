import { describe, expect, it } from 'vitest'
import {
  buildBudgetStatus,
  isBudgetBlocked,
  readBudgetSettings,
  sumSpendSince,
  writeBudgetSettings,
} from '../src/services/budgetService.js'
import { createFakeBudgetDb } from './helpers/fakeBudgetDb.js'

/**
 * Unit test cho `budgetService` (T-M2-03b — FR-PROVIDER-06).
 *
 * AC goc: "Khi vượt hạn mức, server chặn lượt chat mới" → phần quyết định
 * nằm ở service này (đọc config + tổng chi phi + trạng thái).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

describe('readBudgetSettings', () => {
  it('chua co dong → tra ve mac dinh (budget tat)', async () => {
    const fake = createFakeBudgetDb()
    const settings = await readBudgetSettings(fake.db as never)

    expect(settings.enabled).toBe(false)
    expect(settings.limitUsd).toBe(0)
    expect(settings.period).toBe('monthly')
    expect(settings.hardBlock).toBe(true)
  })

  it('doc duoc dong da luu', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({
      enabled: true,
      limitUsd: '5.5',
      warnThresholdPercent: 70,
      period: 'daily',
      hardBlock: false,
    })

    const settings = await readBudgetSettings(fake.db as never)

    expect(settings.enabled).toBe(true)
    expect(settings.limitUsd).toBe(5.5)
    expect(settings.warnThresholdPercent).toBe(70)
    expect(settings.period).toBe('daily')
    expect(settings.hardBlock).toBe(false)
  })

  it('ky la trong DB → fallback về monthly (khong crash)', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ period: 'weekly' })

    const settings = await readBudgetSettings(fake.db as never)
    expect(settings.period).toBe('monthly')
  })
})

describe('writeBudgetSettings', () => {
  it('ghi xuong dong singleton', async () => {
    const fake = createFakeBudgetDb()
    await writeBudgetSettings(fake.db as never, {
      enabled: true,
      limitUsd: 3,
      period: 'daily',
      warnThresholdPercent: 90,
      hardBlock: true,
    })

    const settings = await readBudgetSettings(fake.db as never)
    expect(settings.enabled).toBe(true)
    expect(settings.limitUsd).toBe(3)
    expect(settings.period).toBe('daily')
  })

  it('ghi 2 lan → chi 1 dong (upsert idempotent)', async () => {
    const fake = createFakeBudgetDb()
    const patch = {
      enabled: true,
      limitUsd: 3,
      period: 'daily' as const,
      warnThresholdPercent: 80,
      hardBlock: true,
    }
    await writeBudgetSettings(fake.db as never, patch)
    await writeBudgetSettings(fake.db as never, patch)

    expect(fake.settings).toBeDefined()
    expect(fake.settings?.id).toBe('default')
  })
})

describe('sumSpendSince', () => {
  it('tong chi phi tu moc cho truoc', async () => {
    const fake = createFakeBudgetDb()
    const since = new Date('2026-11-01T00:00:00.000Z')
    fake.addLog({ createdAt: new Date('2026-11-05T00:00:00.000Z'), costUsd: 1.5 })
    fake.addLog({ createdAt: new Date('2026-11-06T00:00:00.000Z'), costUsd: 2.25 })
    fake.addLog({ createdAt: new Date('2026-10-20T00:00:00.000Z'), costUsd: 99 })

    const total = await sumSpendSince(fake.db as never, since)
    expect(total).toBeCloseTo(3.75, 6)
  })

  it('khong co log → 0', async () => {
    const fake = createFakeBudgetDb()
    expect(await sumSpendSince(fake.db as never, new Date())).toBe(0)
  })
})

describe('buildBudgetStatus', () => {
  it('budget tat → state disabled', async () => {
    const fake = createFakeBudgetDb()
    const status = await buildBudgetStatus(fake.db as never)

    expect(status.state).toBe('disabled')
    expect(status.spentUsd).toBe(0)
    expect(status.limitUsd).toBe(0)
    expect(status.percentUsed).toBe(0)
  })

  it('duoi nguong → ok + tinh remaining', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ enabled: true, limitUsd: '10', period: 'daily' })
    fake.addLog({ costUsd: 4 })

    const status = await buildBudgetStatus(fake.db as never)

    expect(status.state).toBe('ok')
    expect(status.spentUsd).toBeCloseTo(4, 6)
    expect(status.remainingUsd).toBeCloseTo(6, 6)
    expect(status.percentUsed).toBeCloseTo(40, 6)
    expect(status.period).toBe('daily')
  })

  it('vuot nguong canh bao → warning', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ enabled: true, limitUsd: '10', warnThresholdPercent: 80 })
    fake.addLog({ costUsd: 8.5 })

    const status = await buildBudgetStatus(fake.db as never)
    expect(status.state).toBe('warning')
  })

  it('vuot han muc → exceeded + remaining = 0', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ enabled: true, limitUsd: '10' })
    fake.addLog({ costUsd: 12 })

    const status = await buildBudgetStatus(fake.db as never)
    expect(status.state).toBe('exceeded')
    expect(status.remainingUsd).toBe(0)
  })

  it('periodStart < periodEnd va la ISO', async () => {
    const fake = createFakeBudgetDb()
    const status = await buildBudgetStatus(fake.db as never)

    expect(new Date(status.periodStart).getTime()).toBeLessThan(
      new Date(status.periodEnd).getTime(),
    )
  })
})

describe('isBudgetBlocked', () => {
  it('budget tat → khong chan', async () => {
    const fake = createFakeBudgetDb()
    expect(await isBudgetBlocked(fake.db as never)).toBe(false)
  })

  it('vuot han muc + hardBlock → chan', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ enabled: true, limitUsd: '1', hardBlock: true })
    fake.addLog({ costUsd: 5 })

    expect(await isBudgetBlocked(fake.db as never)).toBe(true)
  })

  it('vuot han muc + hardBlock TAT → khong chan', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ enabled: true, limitUsd: '1', hardBlock: false })
    fake.addLog({ costUsd: 5 })

    expect(await isBudgetBlocked(fake.db as never)).toBe(false)
  })

  it('duoi han muc → khong chan', async () => {
    const fake = createFakeBudgetDb()
    fake.setSettings({ enabled: true, limitUsd: '10', hardBlock: true })
    fake.addLog({ costUsd: 1 })

    expect(await isBudgetBlocked(fake.db as never)).toBe(false)
  })
})
