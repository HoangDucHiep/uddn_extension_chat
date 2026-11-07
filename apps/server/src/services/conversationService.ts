/**
 * Service CRUD conversation (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Luong:
 *  1. `listConversations()` — danh sach (loc theo `q`, tach `archived`).
 *  2. `createConversation()` / `updateConversation()` / `deleteConversation()`.
 *  3. `getConversationMessages()` — lich su + citations da luu.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.10
 */

import { and, asc, count, desc, eq, ilike, inArray } from 'drizzle-orm'
import { AppError, ERROR_CODES } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { citations, conversations, messages } from '../db/schema.js'

/** Do dai toi da cua tieu de conversation (ky tu) — khop voi `packages/shared`. */
export const MAX_CONVERSATION_TITLE_CHARS = 200

/**
 * Do dai tieu de mac dinh khi tao conversation tu cau hoi dau tien.
 *
 * Cat ngan de danh sach khong bi tran khi panel hep (DP-1).
 */
export const AUTO_TITLE_MAX_CHARS = 60

/** Tieu de mac dinh khi tao conversation rong. */
export const DEFAULT_CONVERSATION_TITLE = 'Cuộc trò chuyện mới'

/** Mot conversation tom tat — dung cho response cua BFF. */
export interface ConversationSummary {
  id: string
  title: string
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  messageCount: number
}

/** Mot message + citations da luu. */
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  provider?: string
  model?: string
  tokensIn?: number
  tokensOut?: number
  citations: Array<{
    index: number
    url: string
    title: string
    snippet: string
    tabId?: number
  }>
}

/** Ket qua list conversation (keyset pagination). */
export interface ConversationListResult {
  items: ConversationSummary[]
  nextCursor: string | undefined
}

/** Mot cuoc tro chuyen duoc dung cho so sanh thu tu (cursor). */
interface ConversationOrderKey {
  pinned: boolean
  updatedAt: string
  id: string
}

/**
 * Tao tieu de conversation tu cau hoi dau tien.
 *
 * Cat ve 60 ky tu dau + them `…` neu bi cat → danh sach de quet.
 *
 * @param content - Noi dung cau hoi cua user.
 */
export function buildAutoTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return DEFAULT_CONVERSATION_TITLE

  if (trimmed.length <= AUTO_TITLE_MAX_CHARS) return trimmed
  return `${trimmed.slice(0, AUTO_TITLE_MAX_CHARS).trimEnd()}…`
}

/**
 * Escape cac ky tu wildcard cua SQL trong chuoi tim kiem.
 *
 * Khong escape → user go `%` se tim tat ca conversation (vô tình).
 * Dung `ESCAPE '\'` de `%` / `_` / `\` tro lai ky tu thuong.
 *
 * @param query - Chuoi nguoi dung go.
 * @returns Chuoi da escape, dung trong `LIKE` pattern.
 */
export function escapeLikePattern(query: string): string {
  return query.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/**
 * So sanh 2 conversation theo thu tu hien thi.
 *
 * Tho tu: `pinned desc, updated_at desc, id desc` → conversation ghim luon
 * o dau danh sach (FR-CHAT-09/11), conversation moi nhat o tiep theo.
 *
 * @param a - Conversation thu nhat.
 * @param b - Conversation thu hai.
 * @returns So am neu `a` truoc `b`.
 */
export function compareConversations(a: ConversationOrderKey, b: ConversationOrderKey): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1

  const byUpdated = b.updatedAt.localeCompare(a.updatedAt)
  if (byUpdated !== 0) return byUpdated

  return b.id.localeCompare(a.id)
}

/**
 * Ma hoa con trong (cursor) cho phan trang.
 *
 * Cursor chua `pinned|updatedAt|id` → phan trang **deterministic**, khong
 * dung OFFSET (tranh trong khi danh sach bi chuyen).
 *
 * @param key - Khoa cua dong cuoi trong page truoc.
 */
export function encodeCursor(key: ConversationOrderKey): string {
  return Buffer.from(`${key.pinned ? '1' : '0'}|${key.updatedAt}|${key.id}`, 'utf8').toString(
    'base64url',
  )
}

/**
 * Giai ma cursor → khoa so sanh.
 *
 * @param cursor - Cursor da ma hoa (base64url).
 * @returns Khoa, hoac `undefined` khi cursor khong hop le.
 */
export function decodeCursor(cursor: string): ConversationOrderKey | undefined {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const parts = decoded.split('|')
    if (parts.length !== 3) return undefined

    const [pinnedRaw, updatedAt, id] = parts
    if (pinnedRaw !== '0' && pinnedRaw !== '1') return undefined
    if (updatedAt === undefined || id === undefined) return undefined
    if (id.length === 0) return undefined
    if (Number.isNaN(new Date(updatedAt).getTime())) return undefined

    return { pinned: pinnedRaw === '1', updatedAt, id }
  } catch {
    return undefined
  }
}

/**
 * Chuyen dong tu DB → summary cho client.
 *
 * @param row - Dong tu bang `conversations`.
 * @param messageCount - So tin nhan cua conversation.
 */
function toSummary(
  row: typeof conversations.$inferSelect,
  messageCount: number,
): ConversationSummary {
  return {
    id: row.id,
    title: row.title,
    pinned: row.pinned,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount,
  }
}

/**
 * Dem so tin nhan cua nhieu conversation (1 query).
 *
 * @param db - Database client.
 * @param ids - Danh sach id conversation.
 * @returns Map `conversationId → messageCount`.
 */
export async function countMessagesByConversation(
  db: Database,
  ids: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (ids.length === 0) return result

  const rows = await db
    .select({
      conversationId: messages.conversationId,
      total: count(messages.id),
    })
    .from(messages)
    .where(inArray(messages.conversationId, [...ids]))
    .groupBy(messages.conversationId)

  for (const row of rows) {
    result.set(row.conversationId, row.total)
  }

  return result
}

/**
 * Liet ke conversation.
 *
 * Loc theo `archived` + `q` (ten) **trong SQL**; sap xep `pinned desc,
 * updated_at desc, id desc`; phan trang bang cursor (keyset) — khong dung
 * OFFSET (tranh trong khi danh sach bi chuyen giua 2 trang).
 *
 * @param db - Database client.
 * @param params - Bo loc + phan trang.
 */
export async function listConversations(
  db: Database,
  params: {
    q?: string | undefined
    archived: boolean
    limit: number
    cursor?: string | undefined
  },
): Promise<ConversationListResult> {
  const query = params.q?.trim()
  const conditions = [eq(conversations.archived, params.archived)]

  if (query !== undefined && query.length > 0) {
    // Escape ky tu wildcard → user go `%` khong tim ra tat ca conversation.
    // Postgres dung `\` lam escape mac dinh cho LIKE/ILIKE.
    conditions.push(ilike(conversations.title, `%${escapeLikePattern(query)}%`))
  }

  const rows = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.pinned), desc(conversations.updatedAt), desc(conversations.id))

  // Keyset pagination: bo cac dong da thay trong page truoc.
  // Cursor chua khoa cua dong cuoi → tim vi tri do va cat phan con lai.
  const anchor = params.cursor !== undefined ? decodeCursor(params.cursor) : undefined
  const startIndex =
    anchor === undefined
      ? 0
      : rows.findIndex(
          (row) =>
            row.id === anchor.id &&
            row.pinned === anchor.pinned &&
            row.updatedAt.toISOString() === anchor.updatedAt,
        ) + 1

  const page = rows.slice(startIndex, startIndex + params.limit)
  const hasMore = startIndex + params.limit < rows.length

  const counts = await countMessagesByConversation(
    db,
    page.map((row) => row.id),
  )

  const items = page.map((row) => toSummary(row, counts.get(row.id) ?? 0))

  const last = page[page.length - 1]
  const nextCursor =
    hasMore && last !== undefined
      ? encodeCursor({
          pinned: last.pinned,
          updatedAt: last.updatedAt.toISOString(),
          id: last.id,
        })
      : undefined

  return { items, nextCursor }
}

/**
 * Tao conversation moi.
 *
 * @param db - Database client.
 * @param title - Tieu de (mac dinh la "Cuộc trò chuyện mới").
 */
export async function createConversation(
  db: Database,
  title?: string,
): Promise<ConversationSummary> {
  const safeTitle = (title ?? DEFAULT_CONVERSATION_TITLE)
    .trim()
    .slice(0, MAX_CONVERSATION_TITLE_CHARS)

  const rows = await db
    .insert(conversations)
    .values({ title: safeTitle.length > 0 ? safeTitle : DEFAULT_CONVERSATION_TITLE })
    .returning()

  const row = rows[0]
  if (row === undefined) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Khong tao duoc cuoc tro chuyen')
  }

  return toSummary(row, 0)
}

/**
 * Cap nhat conversation (doi ten / ghim / luu tru).
 *
 * Chi cap nhat truong duoc gui → `updated_at` duoc bump o moi lan cap nhat.
 *
 * @param db - Database client.
 * @param id - Id conversation.
 * @param patch - Cac truong can doi.
 */
export async function updateConversation(
  db: Database,
  id: string,
  patch: { title?: string | undefined; pinned?: boolean | undefined; archived?: boolean | undefined },
): Promise<ConversationSummary> {
  const values: Partial<typeof conversations.$inferInsert> = {}

  if (patch.title !== undefined) {
    const trimmed = patch.title.trim().slice(0, MAX_CONVERSATION_TITLE_CHARS)
    values.title = trimmed.length > 0 ? trimmed : DEFAULT_CONVERSATION_TITLE
  }
  if (patch.pinned !== undefined) values.pinned = patch.pinned
  if (patch.archived !== undefined) values.archived = patch.archived

  if (Object.keys(values).length === 0) {
    throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Khong co truong nao de cap nhat')
  }

  const rows = await db
    .update(conversations)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning()

  const row = rows[0]
  if (row === undefined) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay cuoc tro chuyen')
  }

  const counts = await countMessagesByConversation(db, [id])
  return toSummary(row, counts.get(id) ?? 0)
}

/**
 * Xoa conversation (cascade xoa messages / citations / attachments).
 *
 * @param db - Database client.
 * @param id - Id conversation.
 */
export async function deleteConversation(db: Database, id: string): Promise<void> {
  const rows = await db.delete(conversations).where(eq(conversations.id, id)).returning()

  if (rows.length === 0) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay cuoc tro chuyen')
  }
}

/**
 * Doc conversation + lich su messages (kem citations da luu).
 *
 * @param db - Database client.
 * @param id - Id conversation.
 */
export async function getConversationMessages(
  db: Database,
  id: string,
): Promise<{ conversation: ConversationSummary; messages: ConversationMessage[] }> {
  const rows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1)
  const conversationRow = rows[0]

  if (conversationRow === undefined) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay cuoc tro chuyen')
  }

  const messageRows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt), asc(messages.id))

  const messageIds = messageRows.map((row) => row.id)
  const citationRows =
    messageIds.length > 0
      ? await db
          .select()
          .from(citations)
          .where(inArray(citations.messageId, messageIds))
          .orderBy(asc(citations.idx))
      : []

  // Gom citation theo message.
  const citationsByMessage = new Map<string, ConversationMessage['citations']>()
  for (const row of citationRows) {
    const list = citationsByMessage.get(row.messageId) ?? []
    list.push({
      index: row.idx,
      url: row.url,
      title: row.title,
      snippet: row.snippet,
      ...(row.tabId !== null ? { tabId: row.tabId } : {}),
    })
    citationsByMessage.set(row.messageId, list)
  }

  const result: ConversationMessage[] = messageRows.map((row) => {
    const meta = row.meta as Record<string, unknown>
    const messageCitations = citationsByMessage.get(row.id) ?? []

    return {
      id: row.id,
      role: normalizeRole(row.role),
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      citations: messageCitations,
      ...(typeof meta['provider'] === 'string' ? { provider: meta['provider'] } : {}),
      ...(typeof meta['model'] === 'string' ? { model: meta['model'] } : {}),
      ...(typeof meta['tokensIn'] === 'number' ? { tokensIn: meta['tokensIn'] } : {}),
      ...(typeof meta['tokensOut'] === 'number' ? { tokensOut: meta['tokensOut'] } : {}),
    }
  })

  const counts = await countMessagesByConversation(db, [id])

  return {
    conversation: toSummary(conversationRow, counts.get(id) ?? 0),
    messages: result,
  }
}

/**
 * Chuan hoa role cua message ve 3 gia tri client biet.
 *
 * Role `tool` (M2) chua co UI → xuong `assistant` de khong lam hong khoi phuc.
 *
 * @param role - Role trong DB.
 */
function normalizeRole(role: string): 'user' | 'assistant' | 'system' {
  if (role === 'user' || role === 'system') return role
  return 'assistant'
}
