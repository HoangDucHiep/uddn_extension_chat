/**
 * Contract + ham thuan cho **budget cap** (FR-PROVIDER-06 — T-M2-03b).
 *
 * Budget cap = nguong chi phi USD nguoi dung dat → canh bao khi vuot nguong,
 * tuỳ chon **chan** luot chat moi khi vuot nguong.
 *
 * File nay **thuan** (khong dung Chrome API, khong dung React, khong dung DB)
 * → dung chung cho server (enforce) + extension (hien thi) + test.
 *
 * ## Vì sao kỳ tính theo **giờ địa phương**?
 *
 * BFF chạy local cùng máy voi trinh duyet → `new Date()` cua Node dung
 * dung muc gio dia phuong cua user → "hom nay" = tu 00:00 **may cua user**.
 * Postgres luu timestamp theo UTC nen khi query `created_at >= periodStart`
 * thi `periodStart` phai duoc tinh theo gio local roi chuyen ve UTC.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

/** Chu ky tinh budget — chi 2 ky de giu don gian. */
export const BUDGET_PERIODS = ['daily', 'monthly'] as const
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number]

/** Trang thai budget sau khi so voi nguong. */
export const BUDGET_STATES = ['disabled', 'ok', 'warning', 'exceeded'] as const
export type BudgetState = (typeof BUDGET_STATES)[number]

/** Nguong canh bao mac dinh (% han muc) — vuot nguong nay → canh bao. */
export const DEFAULT_BUDGET_WARN_PERCENT = 80

/** Han muc mac dinh (USD) — 0 = khong bat. */
export const DEFAULT_BUDGET_LIMIT_USD = 0

/** Ky mac dinh. */
export const DEFAULT_BUDGET_PERIOD: BudgetPeriod = 'monthly'

/**
 * Cai dat budget cua nguoi dung.
 *
 * Luu **phia server** (bang `budget_settings`) → server tu enforce, khong
 * phai tin client (FR-PROVIDER-06).
 */
export interface BudgetSettings {
  /** Bat/tat budget cap. */
  enabled: boolean
  /** Han muc chi phi (USD) cho ky hien tai. `0` = khong gioi han. */
  limitUsd: number
  /** Chu ky tinh: `daily` | `monthly`. */
  period: BudgetPeriod
  /** Nguong canh bao (%) — vuot nguong nay → trang thai `warning`. */
  warnThresholdPercent: number
  /** Khi vuot han muc → **chan** luot chat moi (server tra loi). */
  hardBlock: boolean
}

/** Cai dat budget mac dinh — **tat** (khong chan gi khi user chua chu dong bat). */
export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  enabled: false,
  limitUsd: DEFAULT_BUDGET_LIMIT_USD,
  period: DEFAULT_BUDGET_PERIOD,
  warnThresholdPercent: DEFAULT_BUDGET_WARN_PERCENT,
  hardBlock: true,
}

/**
 * Moc thoi gian bat dau + ket thuc cua ky tinh.
 *
 * `daily` → tu 00:00 hom nay den 00:00 ngay mai.
 * `monthly` → tu 00:00 ngay 1 thang nay den 00:00 ngay 1 thang sau.
 *
 * @param period - Ky tinh.
 * @param now - Moc thoi gian hien tai (mac dinh `new Date()`).
 * @returns Moc bat dau / ket thuc cua ky (theo gio dia phuong).
 */
export function resolveBudgetPeriod(
  period: BudgetPeriod,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  if (period === 'daily') {
    return {
      start: new Date(year, month, day, 0, 0, 0, 0),
      end: new Date(year, month, day + 1, 0, 0, 0, 0),
    }
  }

  return {
    start: new Date(year, month, 1, 0, 0, 0, 0),
    // `new Date(year, month + 1, 1)` → dau thang sau (JS tu xu ly thang 13).
    end: new Date(year, month + 1, 1, 0, 0, 0, 0),
  }
}

/**
 * Do chi phi da dung voi han muc → tra ve trang thai budget.
 *
 * - `disabled` → budget **tat** (hoac han muc = 0).
 * - `ok` → duoi nguong canh bao.
 * - `warning` → da vuot nguong canh bao (chua vuot han muc).
 * - `exceeded` → da vuot han muc.
 *
 * @param input - Cai dat + chi phi da dung trong ky.
 * @returns Trang thai + phan tram da dung.
 */
export function evaluateBudgetState(input: {
  enabled: boolean
  limitUsd: number
  spentUsd: number
  warnThresholdPercent: number
}): { state: BudgetState; percentUsed: number } {
  if (!input.enabled || input.limitUsd <= 0) {
    return { state: 'disabled', percentUsed: 0 }
  }

  const spent = Math.max(0, input.spentUsd)
  const percentUsed = (spent / input.limitUsd) * 100

  if (spent >= input.limitUsd) return { state: 'exceeded', percentUsed }
  if (percentUsed >= input.warnThresholdPercent) return { state: 'warning', percentUsed }
  return { state: 'ok', percentUsed }
}
