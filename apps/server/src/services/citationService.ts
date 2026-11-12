/**
 * Citation service — trich dan nguon theo marker `[N]` (FR-CONTEXT-10 — T-M1-08).
 *
 * Luong:
 *  1. LLM sinh cau tra loi kem marker `[1]`, `[2]` (chi dan chen trong system
 *     prompt khi co context — xem `CITATION_INSTRUCTION`).
 *  2. `extractCitations()` quet text → tra ve danh sach citation theo thu tu
 *     tang dan, chi giu **nhung nguon thuc su duoc trich**.
 *  3. Chat stream yield SSE event `citation` cho tung nguon.
 *  4. `persistCitations()` ghi vao bang `citations` (Postgres).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

import { eq } from 'drizzle-orm'
import { parseCitationMarkers } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { citations as citationsTable } from '../db/schema.js'
import type { ContextItem } from '@sidekick/shared'

/**
 * Mot nguon trich dan da resolve — dung cho ca SSE event va DB.
 */
export interface ResolvedCitation {
  /** So thu tu nguon, 1-based — khop voi marker `[N]` trong cau tra loi. */
  index: number
  url: string
  title: string
  /** Doan trich (snippet) cua nguon. */
  snippet: string
  /** Tab ID neu nguon den tu tab da dinh kem. */
  tabId: number | undefined
}

/**
 * Trich xuat cac nguon duoc trich dan tu cau tra loi cua LLM.
 *
 * - Marker `[N]` → tra ve nguon thu `N` trong `sources` (1-based).
 * - Marker tro toi nguon **khong ton tai** → bo qua (khong tao chip tre).
 * - Marker lap lai → chi giu 1 lan (SSE event phai la unique).
 * - Khong co marker → tra ve mang rong (khong co trich dan → khong co chip).
 *
 * @param text - Noi dung cau tra loi cua LLM.
 * @param sources - Danh sach nguon context **theo thu tu da danh so** (1-based).
 * @returns Danh sach citation theo thu tu tang dan.
 */
export function extractCitations(
  text: string,
  sources: readonly ContextItem[],
): ResolvedCitation[] {
  const markers = parseCitationMarkers(text)
  const result: ResolvedCitation[] = []

  for (const index of markers) {
    // `sources` duoc danh so tu 1 → `sources[index - 1]`.
    const source = sources[index - 1]
    if (source === undefined) continue

    result.push({
      index,
      url: source.url ?? '',
      title: source.title,
      snippet: buildSnippet(source),
      tabId: source.tabId,
    })
  }

  return result
}

/**
 * Tao snippet hien thi cho nguon trich dan.
 *
 * Uu tien `excerpt` (doan da cat san) → giu nguyen, khong cat them.
 * Neu khong co excerpt → cat `text` ve dai toi da.
 *
 * @param source - Context item cua nguon.
 * @returns Snippet hien thi (co the rong).
 */
export function buildSnippet(source: ContextItem): string {
  const base = source.excerpt ?? source.text ?? ''
  const MAX_LENGTH = 320

  if (base.length <= MAX_LENGTH) return base
  return `${base.slice(0, MAX_LENGTH).trimEnd()}…`
}

/**
 * Xoa cac citation cua 1 message (dung cho `continue` — viet lai noi dung
 * thi citation cu cua phan bi stop phai bi thay the).
 *
 * Khong throw — loi ghi DB khong duoc lam mat luong chat.
 *
 * @param db - Database client.
 * @param messageId - ID cua message assistant.
 */
export async function clearCitations(db: Database, messageId: string): Promise<void> {
  try {
    await db.delete(citationsTable).where(eq(citationsTable.messageId, messageId))
  } catch {
    // Xoa that bai → citation cu van hien thi (khong hong luong chat).
    console.warn('[citationService] không xoá được citations cũ')
  }
}

/**
 * Ghi cac citation vao bang `citations`.
 *
 * Khong throw — loi ghi DB khong duoc lam mat luong chat da stream xong
 * (client van nhan duoc cau tra loi + chip).
 *
 * @param db - Database client.
 * @param messageId - ID cua message assistant vua luu.
 * @param items - Danh sach citation can ghi.
 */
export async function persistCitations(
  db: Database,
  messageId: string,
  items: readonly ResolvedCitation[],
): Promise<void> {
  if (items.length === 0) return

  try {
    await db.insert(citationsTable).values(
      items.map((item) => ({
        messageId,
        idx: item.index,
        url: item.url,
        title: item.title,
        snippet: item.snippet,
        tabId: item.tabId ?? null,
      })),
    )
  } catch {
    // Ghi log that bai → citation chi con ton tai trong SSE (van hien thi du).
    console.warn('[citationService] không ghi được citations vào DB')
  }
}
