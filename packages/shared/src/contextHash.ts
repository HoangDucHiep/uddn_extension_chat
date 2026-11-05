/**
 * Hash thuan dung chung cho context (T-M1-06).
 *
 * Khong import `node:crypto` va khong phu thuoc runtime nao → dung duoc cho
 * extension (side panel) va server. KHONG import vao content script
 * (`@sidekick/shared/constants` la subpath rieng) de giu bundle nho.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.5
 */

import { CONTEXT_TIER_ORDER } from './contextBudget.js'
import type { ContextItem } from './schemas/chat.js'

/** Ky tu phan tach giua cac truong khi bam (khong the xuat hien trong text). */
const FIELD_SEPARATOR = '\u0000'

/**
 * Hash chuoi 32-bit FNV-1a → hex.
 *
 * Dung de tao khoa on dinh (id item, khoa cache, hash context) — KHONG phai
 * ham bao mat. Muc dich: cung noi dung → cung hash, de so sanh/doi chieu.
 *
 * @param text - Chuoi can bam.
 */
export function hashString(text: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    // hash *= 16777619 (FNV prime), lam bang phong to de tranh float.
    hash = Math.imul(hash, 0x01000193) >>> 0
  }

  return hash.toString(16).padStart(8, '0')
}

/**
 * Hash deterministic cua danh sach context item.
 *
 * Dung de `request_logs.context_hash` — phai **khop** voi context thuc su
 * da gui len provider. Vi vay:
 *  - Item duoc sap xep theo thu tu uu tien `tier` (`CONTEXT_TIER_ORDER`)
 *    roi theo `id` → thu tu gui khong lam doi hash.
 *  - Chi nhung truong **anh huong toi noi dung** moi duoc nam trong hash
 *    (`truncated`/`droppedChars`/`tokens` la thuoc tinh ngan sach, khong tinh).
 *  - Rỗng → chuỗi rỗng (server ghi `null`).
 *
 * @param items - Danh sach context item da gui (sau khi cat ngan sach).
 */
export function hashContextItems(items: readonly ContextItem[]): string {
  if (items.length === 0) return ''

  const sorted = [...items].sort((a, b) => {
    const tierDiff = tierRank(a.tier) - tierRank(b.tier)
    if (tierDiff !== 0) return tierDiff
    return a.id.localeCompare(b.id)
  })

  const parts: string[] = []
  for (const item of sorted) {
    parts.push(
      [
        item.id,
        item.kind,
        item.tier,
        item.url ?? '',
        item.title,
        item.sourceKind ?? '',
        item.text ?? '',
      ].join(FIELD_SEPARATOR),
    )
  }

  return hashString(parts.join(FIELD_SEPARATOR))
}

/**
 * Thu tu uu tien tier (cao → thap) — cung thu tu voi `CONTEXT_TIER_ORDER`.
 *
 * Item co tier la `history` (khong phai context item) → rank thap nhat.
 */
function tierRank(tier: string): number {
  const index = CONTEXT_TIER_ORDER.indexOf(tier as ContextItem['tier'])
  return index === -1 ? CONTEXT_TIER_ORDER.length : index
}

/**
 * Khoa cache theo URL — chuan hoa de cung mot trang luon ra cung khoa.
 *
 * Bo fragment (`#`) va query (`?`, `&`) vi chung khong doi noi dung trang,
 * lower-case host (host la case-insensitive).
 *
 * @param url - URL cua trang.
 */
export function contextHashKey(url: string): string {
  const trimmed = url.trim()
  if (trimmed.length === 0) return ''

  try {
    const parsed = new URL(trimmed)
    parsed.hash = ''
    parsed.search = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    return parsed.toString()
  } catch {
    // URL khong parse duoc → dung chuoi rong da trim.
    return trimmed
  }
}
