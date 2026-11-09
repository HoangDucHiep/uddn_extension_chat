/**
 * Service doc / don dep `request_logs` (T-M1-14).
 *
 *  1. `pruneRequestLogs()` — xoa dong cu hon thoi han giu (retention §5.2).
 *  2. `listRequestLogs()` — danh sach log (chi metadata) cho eval.
 *  3. `aggregateUsage()` — tong hop token + chi phi theo ngay.
 *
 * Docs: docs/SYSTEM_DESIGN.md §5.2, §7.16
 */

import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { hashContextItems, type BudgetedContextItem } from '@sidekick/shared'
import type { RequestLogSummary, UsageByDay } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { requestLogs } from '../db/schema.js'

/** Du lieu 1 luot chat can ghi vao `request_logs`. */
export interface RequestLogData {
  /** Request-id xuyen suot client → BFF → provider. */
  requestId: string
  /** Conversation ma luot chat nay thuoc ve. */
  conversationId: string
  /** Provider da su dung. */
  provider: string
  /** Model da su dung. */
  model: string
  /** Nguon API key (`K1` · `K2` · `K3` · `none`). */
  keySource: string
  /** Prompt da gui (chi luu khi `logFullContent`). */
  promptText: string
  /** Cau tra loi (chi luu khi `logFullContent`). */
  responseText: string
  /** Context **da cat ngan sach** — dung de tinh `context_hash` + snapshot. */
  contextItems: readonly BudgetedContextItem[]
  /** So token input. */
  tokensIn: number
  /** So token output. */
  tokensOut: number
  /** Chi phi USD cua luot nay. */
  costUsd: number
  /** Thoi gian den token dau tien (ms). */
  ttftMs: number
  /** Tong thoi gian luot chat (ms). */
  latencyMs: number
  /** Error code neu luot that bai. */
  error: string | undefined
  /** Cac tool call phat sinh (M2 moi co that). */
  toolCalls: Array<Record<string, unknown>> | null
  /**
   * Provider **bi loi truoc do** khi server fallback sang provider khac.
   *
   * T-M2-02 (FR-PROVIDER-04) — `null` neu khong co fallback nao xay ra.
   */
  fallbackFrom?: string | null | undefined
}

/**
 * Snapshot context da cat ngan sach — luu vao `request_logs.context_snapshot`.
 *
 * Chi dung khi setting `LOG_CONTEXT_SNAPSHOT=true` (mac dinh TAT) vi chua
 * **noi dung trang** → du lieu nhay cam.
 *
 * @param items - Context item da cat ngan sach.
 */
export function buildContextSnapshot(
  items: readonly BudgetedContextItem[],
): Array<Record<string, unknown>> {
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    tier: item.tier,
    url: item.url ?? null,
    title: item.title ?? null,
    sourceKind: item.sourceKind ?? null,
    text: item.text,
    excerpt: item.excerpt ?? null,
    truncated: item.truncated ?? false,
  }))
}

/**
 * Ghi 1 dong `request_logs`.
 *
 * `context_hash` = hash cua **context thuc su da gui cho provider** (khong
 * phai hash cua toan bo prompt) → AC "context_hash khop voi context da gui".
 * `context_snapshot` = jsonb chua context da cat — **mac dinh TAT** (noi dung
 * trang la du lieu nhay cam) → chi bat khi setting `LOG_CONTEXT_SNAPSHOT=true`.
 *
 * @param db - Database client.
 * @param data - Du lieu luot chat can ghi.
 * @param logFullContent - Luu prompt + response day du (mac dinh TAT).
 * @param logContextSnapshot - Luu snapshot context (mac dinh TAT).
 */
export async function insertRequestLog(
  db: Database,
  data: RequestLogData,
  logFullContent: boolean,
  logContextSnapshot: boolean,
): Promise<void> {
  const contextHash = hashContextItems(data.contextItems)

  await db.insert(requestLogs).values({
    requestId: data.requestId,
    conversationId: data.conversationId,
    provider: data.provider,
    model: data.model || 'unknown',
    keySource: data.keySource,
    promptText: logFullContent ? data.promptText : null,
    responseText: logFullContent ? data.responseText : null,
    contextHash: contextHash.length > 0 ? contextHash : null,
    // Khong co context → `null` (dong nhat voi `context_hash = null`).
    contextSnapshot:
      logContextSnapshot && data.contextItems.length > 0
        ? buildContextSnapshot(data.contextItems)
        : null,
    tokensIn: data.tokensIn,
    tokensOut: data.tokensOut,
    // `numeric(12, 6)` → ghi dang chuoi de khong lam tron 2 lan.
    costUsd: data.costUsd.toFixed(6),
    ttftMs: data.ttftMs,
    latencyMs: data.latencyMs,
    toolCalls: data.toolCalls ?? null,
    error: data.error ?? null,
    // Provider bi loi truoc do khi fallback (T-M2-02) — null neu khong fallback.
    fallbackFrom: data.fallbackFrom ?? null,
  })
}

/** Moc thoi gian cho 1 query log. */
export interface RequestLogQuery {
  /** So dong toi da tra ve. */
  limit: number
  /** So dong bo qua. */
  offset: number
  /** Loc theo provider. */
  provider?: string | undefined
  /** Loc theo conversation. */
  conversationId?: string | undefined
  /** Tu thoi diem (inclusive). */
  from?: Date | undefined
  /** Den thoi diem (inclusive). */
  to?: Date | undefined
}

/** Ket qua list log + tong so dong khop bo loc. */
export interface RequestLogListResult {
  items: RequestLogSummary[]
  total: number
}

/**
 * Tao dieu kien loc theo query.
 *
 * @param query - Bo loc tu route.
 */
function buildFilters(query: RequestLogQuery) {
  const conditions = []

  if (query.provider !== undefined) {
    conditions.push(eq(requestLogs.provider, query.provider))
  }
  if (query.conversationId !== undefined) {
    conditions.push(eq(requestLogs.conversationId, query.conversationId))
  }
  if (query.from !== undefined) {
    conditions.push(gte(requestLogs.createdAt, query.from))
  }
  if (query.to !== undefined) {
    conditions.push(lte(requestLogs.createdAt, query.to))
  }

  return conditions
}

/**
 * So tool call trong 1 dong log.
 *
 * `tool_calls` la jsonb — co the la array hoac `null`.
 *
 * @param toolCalls - Gia tri jsonb thô.
 */
export function countToolCalls(toolCalls: unknown): number {
  if (!Array.isArray(toolCalls)) return 0
  return toolCalls.length
}

/**
 * Chuyen dong DB → summary (chi metadata).
 *
 * KHONG gom `promptText` / `responseText` / `contextSnapshot` → API doc
 * khong bao gio lo noi dung nguoi dung ra ngoai.
 *
 * @param row - Dong tu bang `request_logs`.
 */
export function toRequestLogSummary(row: typeof requestLogs.$inferSelect): RequestLogSummary {
  return {
    id: row.id,
    requestId: row.requestId,
    conversationId: row.conversationId,
    provider: row.provider,
    model: row.model,
    keySource: row.keySource,
    contextHash: row.contextHash,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    costUsd: Number(row.costUsd),
    ttftMs: row.ttftMs,
    latencyMs: row.latencyMs,
    toolCallCount: countToolCalls(row.toolCalls),
    error: row.error,
    // Provider bi loi truoc do khi fallback (T-M2-02).
    fallbackFrom: row.fallbackFrom ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * List `request_logs` (chi metadata) — dung cho eval harness.
 *
 * @param db - Database client.
 * @param query - Bo loc + phan trang.
 */
export async function listRequestLogs(
  db: Database,
  query: RequestLogQuery,
): Promise<RequestLogListResult> {
  const conditions = buildFilters(query)

  const rows = await db
    .select()
    .from(requestLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(requestLogs.createdAt))
    .limit(query.limit)
    .offset(query.offset)

  const countRows = await db
    .select({ total: count(requestLogs.id) })
    .from(requestLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return {
    items: rows.map(toRequestLogSummary),
    total: countRows[0]?.total ?? 0,
  }
}

/** Tong hop usage theo ngay. */
export interface UsageAggregate {
  totalTokens: number
  totalCostUsd: number
  byDay: UsageByDay[]
}

/**
 * Tong hop token + chi phi theo ngay tu `request_logs`.
 *
 * Gom theo `created_at::date` (UTC) → 1 dong cho moi ngay co phat sinh
 * luot chat.
 *
 * @param db - Database client.
 * @param range - Khoang thoi gian (optional).
 */
export async function aggregateUsage(
  db: Database,
  range: { from?: Date | undefined; to?: Date | undefined },
): Promise<UsageAggregate> {
  const conditions = []
  if (range.from !== undefined) {
    conditions.push(gte(requestLogs.createdAt, range.from))
  }
  if (range.to !== undefined) {
    conditions.push(lte(requestLogs.createdAt, range.to))
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      date: sql<string>`to_char(${requestLogs.createdAt}, 'YYYY-MM-DD')`,
      tokensIn: sql<number>`coalesce(sum(${requestLogs.tokensIn}), 0)`,
      tokensOut: sql<number>`coalesce(sum(${requestLogs.tokensOut}), 0)`,
      costUsd: sql<number>`coalesce(sum(${requestLogs.costUsd}), 0)`,
      requests: sql<number>`count(*)`,
    })
    .from(requestLogs)
    .where(where)
    .groupBy(sql`to_char(${requestLogs.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${requestLogs.createdAt}, 'YYYY-MM-DD')`)

  const byDay: UsageByDay[] = rows.map((row) => {
    const tokensIn = Number(row.tokensIn)
    const tokensOut = Number(row.tokensOut)
    return {
      date: row.date,
      tokensIn,
      tokensOut,
      totalTokens: tokensIn + tokensOut,
      costUsd: Number(Number(row.costUsd).toFixed(6)),
      requests: Number(row.requests),
    }
  })

  return {
    totalTokens: byDay.reduce((sum, day) => sum + day.totalTokens, 0),
    totalCostUsd: Number(byDay.reduce((sum, day) => sum + day.costUsd, 0).toFixed(6)),
    byDay,
  }
}

/**
 * Xoa cac dong `request_logs` cu hon `retentionDays` ngay.
 *
 * `retentionDays <= 0` → khong xoa (giu vinh vien).
 *
 * @param db - Database client.
 * @param retentionDays - So ngay giu lai.
 * @returns So dong da xoa.
 */
export async function pruneRequestLogs(
  db: Database,
  retentionDays: number,
  now: Date = new Date(),
): Promise<number> {
  if (retentionDays <= 0) return 0

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

  const deleted = await db
    .delete(requestLogs)
    .where(sql`${requestLogs.createdAt} < ${cutoff}`)
    .returning({ id: requestLogs.id })

  return deleted.length
}
