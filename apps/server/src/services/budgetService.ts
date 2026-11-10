/**
 * Service budget cap (FR-PROVIDER-06 — T-M2-03b).
 *
 * ## Nguon su that
 *
 * - **Cau hinh** budget: bang `budget_settings` (singleton, id = `'default'`).
 * - **Chi phi da dung**: `SUM(request_logs.cost_usd)` trong ky dang tinh.
 *   `cost_usd` duoc server tinh tu `PROVIDER_PRICING` (T-M1-14) → khong
 *   lo chenh lech voi gia that.
 *
 * ## Vi sao enforce o server?
 *
 * Neu client tu so sanh → nguoi dung (hoac bat ky extension khac) co the
 * bo qua. Server la **nguon chan su that** cua chi phi → chan o day moi
 * dung nghĩa "chan luot chat moi khi vuot han muc".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

import { eq, gte, sql } from 'drizzle-orm'
import {
  DEFAULT_BUDGET_SETTINGS,
  evaluateBudgetState,
  resolveBudgetPeriod,
  type BudgetPeriod,
  type BudgetSettings,
  type BudgetStatus,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { budgetSettings, requestLogs } from '../db/schema.js'

/** Id cua dong cau hinh budget (singleton). */
export const BUDGET_SETTINGS_ID = 'default'

/**
 * Doc cau hinh budget hien tai.
 *
 * Chua co dong nao trong DB → tra ve `DEFAULT_BUDGET_SETTINGS` (budget **tat**).
 * Dong co du lieu sai (vd `period` la chuoi la) → fallback field sai, giu
 * field hop le — cung kieu fallback **tung field** nhu `readSettings()`.
 *
 * @param db - Database client.
 * @returns Cau hinh budget.
 */
export async function readBudgetSettings(db: Database): Promise<BudgetSettings> {
  try {
    const rows = await db
      .select()
      .from(budgetSettings)
      .where(eq(budgetSettings.id, BUDGET_SETTINGS_ID))
      .limit(1)

    const row = rows[0]
    if (row === undefined) return { ...DEFAULT_BUDGET_SETTINGS }

    const limitUsd = Number(row.limitUsd)
    const period: BudgetPeriod = row.period === 'daily' ? 'daily' : 'monthly'

    return {
      enabled: row.enabled,
      limitUsd: Number.isFinite(limitUsd) && limitUsd >= 0 ? limitUsd : 0,
      period,
      warnThresholdPercent:
        row.warnThresholdPercent >= 1 && row.warnThresholdPercent <= 100
          ? row.warnThresholdPercent
          : DEFAULT_BUDGET_SETTINGS.warnThresholdPercent,
      hardBlock: row.hardBlock,
    }
  } catch {
    // DB loi → budget coi nhu **tat** (khong chan chat khi khong biet).
    return { ...DEFAULT_BUDGET_SETTINGS }
  }
}

/**
 * Ghi cau hinh budget (upsert vao dong singleton).
 *
 * @param db - Database client.
 * @param settings - Cau hinh moi (day du).
 * @returns Cau hinh da ghi.
 */
export async function writeBudgetSettings(
  db: Database,
  settings: BudgetSettings,
): Promise<BudgetSettings> {
  const values = {
    id: BUDGET_SETTINGS_ID,
    enabled: settings.enabled,
    limitUsd: settings.limitUsd.toFixed(6),
    warnThresholdPercent: settings.warnThresholdPercent,
    period: settings.period,
    hardBlock: settings.hardBlock,
    updatedAt: new Date(),
  }

  await db
    .insert(budgetSettings)
    .values(values)
    .onConflictDoUpdate({
      target: budgetSettings.id,
      set: {
        enabled: values.enabled,
        limitUsd: values.limitUsd,
        warnThresholdPercent: values.warnThresholdPercent,
        period: values.period,
        hardBlock: values.hardBlock,
        updatedAt: values.updatedAt,
      },
    })

  return settings
}

/**
 * Tong chi phi (USD) da ghi nhan tu moc `since` tro di.
 *
 * Chi tinh dong `request_logs` **co** chi phi (dinh dang numeric → string).
 * `LOG_REQUESTS=false` → khong co dong nao → tong = 0 (budget khong chan).
 *
 * @param db - Database client.
 * @param since - Moc bat dau ky (Date).
 * @returns Tong chi phi USD.
 */
export async function sumSpendSince(db: Database, since: Date): Promise<number> {
  try {
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${requestLogs.costUsd}), 0)` })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, since))

    const total = Number(rows[0]?.total ?? 0)
    return Number.isFinite(total) ? total : 0
  } catch {
    // DB loi → coi nhu chua chi phi (khong chan chat nham).
    return 0
  }
}

/**
 * Build trang thai budget tai thoi diem `now`.
 *
 * @param db - Database client.
 * @param now - Moc thoi gian hien tai (mac dinh `new Date()`).
 * @returns Trang thai budget day du (de client hien thi).
 */
export async function buildBudgetStatus(
  db: Database,
  now: Date = new Date(),
): Promise<BudgetStatus> {
  const settings = await readBudgetSettings(db)
  const period = resolveBudgetPeriod(settings.period, now)
  const spentUsd = await sumSpendSince(db, period.start)

  const { state, percentUsed } = evaluateBudgetState({
    enabled: settings.enabled,
    limitUsd: settings.limitUsd,
    spentUsd,
    warnThresholdPercent: settings.warnThresholdPercent,
  })

  const remainingUsd =
    settings.limitUsd > 0 ? Math.max(0, settings.limitUsd - spentUsd) : 0

  return {
    settings,
    spentUsd,
    limitUsd: settings.limitUsd,
    remainingUsd,
    percentUsed,
    state,
    period: settings.period,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  }
}

/**
 * Kiem tra 1 luot chat moi co bi **chan** boi budget cap khong.
 *
 * @param db - Database client.
 * @param now - Moc thoi gian hien tai.
 * @returns `true` neu luot chat bi chan (vuot han muc + hardBlock bat).
 */
export async function isBudgetBlocked(db: Database, now: Date = new Date()): Promise<boolean> {
  const settings = await readBudgetSettings(db)
  if (!settings.enabled || settings.limitUsd <= 0) return false
  if (!settings.hardBlock) return false

  const period = resolveBudgetPeriod(settings.period, now)
  const spentUsd = await sumSpendSince(db, period.start)

  const { state } = evaluateBudgetState({
    enabled: settings.enabled,
    limitUsd: settings.limitUsd,
    spentUsd,
    warnThresholdPercent: settings.warnThresholdPercent,
  })

  return state === 'exceeded'
}
