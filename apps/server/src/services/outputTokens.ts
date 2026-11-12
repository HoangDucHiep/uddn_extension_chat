/**
 * Helper phia server cho gioi han do dai output (FR-CHAT-15 — T-M2-24).
 *
 * - `effectiveMaxOutputTokens` — gia tri `max_tokens` se gui cho provider
 *   (da clamp theo tran cua provider).
 * - `hasBudgetRoom` — con cho phep tu noi tiep (auto-continue) hay khong,
 *   dua tren budget cap (FR-PROVIDER-06).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.30
 */

import { resolveMaxOutputTokens, type ProviderId } from '@sidekick/shared'

/**
 * So token output cua 1 luot chat (da giu ca tran cua provider).
 *
 * Dung **chung** cho `provider.stream()` va `reservedOutputTokens` →
 * ngan sach context va yeu cau provider luoi dung 1 con so (truong hop
 * client xin 32k nhung provider chi cho 16k → ca 2 deu dung 16k).
 *
 * @param providerId - Provider se xu ly request.
 * @param requested - So token client yeu cau (co the `undefined`).
 * @returns So token output cuoi cung (>= 1).
 */
export function effectiveMaxOutputTokens(
  providerId: ProviderId,
  requested?: number,
): number {
  return resolveMaxOutputTokens(providerId, requested)
}

/**
 * Con cho phep tu noi tiep cau tra loi (auto-continue) hay khong.
 *
 * Budget **tat** → luon cho phep. Budget **bat** → chi cho phep khi chi phi
 * da dung van con duoi han muc (tránh auto-continue lam vuot han muc cap).
 *
 * @param budgetEnabled - Budget cap co bat khong.
 * @param limitUsd - Han muc (USD) cua ky.
 * @param spentUsd - Chi phi da dung trong ky (USD).
 * @returns `true` neu duoc phep tu noi tiep.
 */
export function hasBudgetRoom(
  budgetEnabled: boolean,
  limitUsd: number,
  spentUsd: number,
): boolean {
  if (!budgetEnabled) return true
  if (limitUsd <= 0) return true
  return spentUsd < limitUsd
}
