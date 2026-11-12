/**
 * Client goi BFF cho **budget cap** (T-M2-03b — FR-PROVIDER-06).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 * Response parse bang `budgetStatusSchema` (nguon su that) → response sai
 * shape bi bo qua thay vi lam **sập** UI.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

import {
  API_ROUTES,
  budgetStatusSchema,
  type BudgetSettings,
  type BudgetStatus,
} from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/**
 * Trang thai budget hien tai (cau hinh + chi phi da dung trong ky).
 */
export async function fetchBudgetStatus(): Promise<BudgetStatus> {
  const response = await fetchJson<unknown>(API_ROUTES.budget)
  const parsed = budgetStatusSchema.safeParse(response)
  if (!parsed.success) {
    throw new Error('Phản hồi budget không hợp lệ')
  }
  return parsed.data
}

/**
 * Luu cau hinh budget moi → tra ve trang thai budget sau khi luu.
 *
 * @param patch - Phan cau hinh can doi.
 */
export async function updateBudgetSettings(
  patch: Partial<BudgetSettings>,
): Promise<BudgetStatus> {
  const response = await fetchJson<unknown>(API_ROUTES.budget, {
    method: 'PUT',
    body: JSON.stringify(patch),
  })
  const parsed = budgetStatusSchema.safeParse(response)
  if (!parsed.success) {
    throw new Error('Phản hồi budget không hợp lệ')
  }
  return parsed.data
}
