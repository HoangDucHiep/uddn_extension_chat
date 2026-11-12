/**
 * Helper cat ngan "excerpt" — dung chung giua extension va server.
 *
 * ## Vì sao cần helper riêng?
 *
 * `excerpt` la chuoi **ngan** dung de preview tren chip context. Contract
 * (`contextItemSchema`) gioi han `excerpt` <= `LIMITS.MAX_EXCERPT_CHARS`
 * (500) — **ke ca** sau khi them dau `...`.
 *
 * Da co bug (T-M2-23): nhieu noi cat `text.slice(0, 500)` roi **them** `"..."`
 * → tong 503 ky tu → `contextItemSchema` **reject** → `chatRequestSchema`
 * reject → `POST /api/chat` tra **400 "Body chat không hợp lệ"** → panel
 * **khong chat duoc** sau khi dinh kem 1 tai lieu.
 *
 * Dinh nghia "cat + them dau ellipsis" **mot lan** o day de khong noi noi
 * nao sinh ra excerpt vuot gioi han nua.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29.4.2
 */

/**
 * Cat chuoi thanh excerpt ngan, luon **khong vuot** `maxChars`.
 *
 * - `text` ngan hon `maxChars` → tra nguyen.
 * - Nguoc lai → cat `maxChars - 3` ky tu + `"..."` → tong **bang** `maxChars`.
 *
 * @param text - Chuoi goc.
 * @param maxChars - Do dai toi da cua excerpt (bao gom dau ellipsis).
 * @returns Excerpt da cat, do dai <= `maxChars`.
 */
export function clampExcerpt(text: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (text.length <= maxChars) return text

  // Duoi 3 ky tu thi khong con cho dau ellipsis → cat thang.
  if (maxChars <= 3) return text.slice(0, maxChars)

  return `${text.slice(0, maxChars - 3).trimEnd()}...`
}
