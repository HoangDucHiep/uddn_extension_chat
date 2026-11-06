/**
 * Hop dong trich dan (FR-CONTEXT-10 — T-M1-08).
 *
 * Luu tri:
 *  1. Server gan nhan `[N]` cho tung nguon context trong prompt.
 *  2. LLM sinh cau tra loi kem marker `[N]` (vd "gia do la 30% [1]").
 *  3. Server parse marker -> phat SSE event `citation` + ghi bang `citations`.
 *  4. Client (extension) thay marker bang chip inline.
 *
 * Regex + instruction nam o `packages/shared` de **server va extension dung
 * chung 1 mau** — tranh truong hop hai ben lech nhau.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

/**
 * Regex bat marker trich dan `[N]`.
 *
 * - Chi bat so (1–2 chu so) → tranh bat nham `[2024]` hay `[a]`.
 * - Co **global flag** de tien tach nhieu marker trong 1 doan text.
 *
 * LUU Y: ham co `g` flag nen `lastIndex` bi mutate khi dung `exec`/`test`.
 * Dung `matchAll` (tu clone regex) hoac `parseCitationMarkers` de khong loi.
 */
export const CITATION_MARKER_PATTERN = /\[(\d{1,2})\]/g

/**
 * Chi dan them vao system prompt khi co context.
 *
 * Chi them khi **co** context — khong co context thi khong co nguon de trich
 * dan, them chi dan chi lam model phat sinh `[N]` ma khong co nguon.
 */
export const CITATION_INSTRUCTION =
  'Khi trích dẫn thông tin từ các nguồn được cung cấp, hãy ghi kèm số nguồn trong ngoặc vuông ' +
  'ngay sau câu, ví dụ [1] hoặc [1][2]. Chỉ dùng số của các nguồn đã được cung cấp.'

/**
 * Lay danh sach so nguon xuat hien trong text.
 *
 * Ket qua **distinct** va **tang dan** → thu tu hien thi o chip la on dinh,
 * khong phu thuoc thu tu model sinh marker.
 *
 * @param text - Noi dung can tra trich dan.
 * @returns Danh sach so nguon (rong neu khong co marker).
 */
export function parseCitationMarkers(text: string): number[] {
  if (text.length === 0) return []

  const found = new Set<number>()

  // `matchAll` khong mutate `lastIndex` cua regex goc → an toan ham la thuan.
  for (const match of text.matchAll(CITATION_MARKER_PATTERN)) {
    const index = Number.parseInt(match[1] ?? '', 10)
    if (Number.isInteger(index) && index > 0) {
      found.add(index)
    }
  }

  return [...found].sort((a, b) => a - b)
}
