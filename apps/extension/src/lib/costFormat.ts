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
 * - Gia tri > 0 → **4 chu so nghinh** (vi du `0.0004` · `0.0123`).
 *   Khong lam tron 2 chu so vi chi phi nho se ra `0.00` → mat thong tin.
 *
 * @param costUsd - Chi phi USD can dinh dang.
 */
export function formatCostUsd(costUsd: number | undefined): string {
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd <= 0) return ''

  return costUsd.toFixed(4)
}
