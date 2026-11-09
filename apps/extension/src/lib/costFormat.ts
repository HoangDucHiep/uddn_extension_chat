/**
 * Dinh dang chi phi USD cho UI (T-M2-03 — FR-PROVIDER-05).
 *
 * Chi phi do server tinh tu bang gia token (uoc luong, khong phai hoa don)
 * → hien thi phai **ngan gon** va de doc trong side panel hep.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.23
 */

/**
 * Dinh dang 1 so USD thanh chuoi hien thi.
 *
 * - `0` (hoac rong) → chuoi rong (de caller hien thi "mien phi").
 * - `< 0.01` → giu 4 chu so nghinh (vi du `0.0004`) vi lam tron 2 chu so
 *   se ra `0.00` → mat thong tin.
 * - `>= 0.01` → 4 chu so nghinh (vi du `0.0123`).
 *
 * @param costUsd - Chi phi USD can dinh dang.
 */
export function formatCostUsd(costUsd: number | undefined): string {
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd <= 0) return ''

  if (costUsd < 0.01) {
    return costUsd.toFixed(4)
  }

  return costUsd.toFixed(4)
}
