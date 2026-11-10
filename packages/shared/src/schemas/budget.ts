/**
 * Zod schema cho contract budget cap (FR-PROVIDER-06 — T-M2-03b).
 *
 * Dat o `packages/shared` de server (validate o bien) va extension (parse
 * response) dung **chung 1 nguon su that**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

import { z } from 'zod'
import { BUDGET_PERIODS, BUDGET_STATES } from '../budget.js'

/** Chu ky tinh budget. */
export const budgetPeriodSchema = z.enum(BUDGET_PERIODS)
export type BudgetPeriodInput = z.infer<typeof budgetPeriodSchema>

/** Trang thai budget. */
export const budgetStateSchema = z.enum(BUDGET_STATES)
export type BudgetStateInput = z.infer<typeof budgetStateSchema>

/** Cai dat budget cua nguoi dung (luu phia server). */
export const budgetSettingsSchema = z.object({
  /** Bat/tat budget cap. */
  enabled: z.boolean(),
  /** Han muc chi phi (USD) — `0` = khong gioi han. */
  limitUsd: z.number().min(0).max(1_000_000),
  /** Chu ky tinh. */
  period: budgetPeriodSchema,
  /** Nguong canh bao (%) — 1..100. */
  warnThresholdPercent: z.number().int().min(1).max(100),
  /** Khi vuot han muc → chan luot chat moi. */
  hardBlock: z.boolean(),
})
export type BudgetSettingsInput = z.infer<typeof budgetSettingsSchema>

/** Patch cai dat budget (chi cho phep doi cac field da biet). */
export const budgetSettingsPatchSchema = budgetSettingsSchema.partial()
export type BudgetSettingsPatchInput = z.infer<typeof budgetSettingsPatchSchema>

/** Trang thai budget tien hanh — tra ve cho client. */
export const budgetStatusSchema = z.object({
  /** Cai dat hien tai. */
  settings: budgetSettingsSchema,
  /** Chi phi da dung trong ky (USD). */
  spentUsd: z.number().nonnegative(),
  /** Han muc (USD) — lai tu `settings.limitUsd` de client khong phai tinh lai. */
  limitUsd: z.number().nonnegative(),
  /** So USD con lai (0 khi vuot han muc). */
  remainingUsd: z.number(),
  /** Phan tram da dung (%) — 0 khi budget tat. */
  percentUsed: z.number().nonnegative(),
  /** Trang thai. */
  state: budgetStateSchema,
  /** Ky dang tinh. */
  period: budgetPeriodSchema,
  /** Moc bat dau ky (ISO 8601). */
  periodStart: z.string(),
  /** Moc ket thuc ky (ISO 8601). */
  periodEnd: z.string(),
})
export type BudgetStatus = z.infer<typeof budgetStatusSchema>
