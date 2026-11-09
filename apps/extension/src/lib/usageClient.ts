/**
 * Client goi BFF cho thong ke token + chi phi (T-M2-03 — FR-PROVIDER-05).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.23
 */

import { API_ROUTES, type UsageResponse } from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/**
 * Tong hop token + chi phi theo ngay.
 *
 * @param range - Khoang thoi gian (optional).
 */
export async function fetchUsage(range?: {
  from?: string | undefined
  to?: string | undefined
}): Promise<UsageResponse> {
  const params = new URLSearchParams()
  if (range?.from !== undefined) params.set('from', range.from)
  if (range?.to !== undefined) params.set('to', range.to)

  const query = params.toString()
  const path = query.length > 0 ? `${API_ROUTES.usage}?${query}` : API_ROUTES.usage

  return fetchJson<UsageResponse>(path)
}
