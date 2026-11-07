/**
 * Zod schema cho API doc log va thong ke usage (T-M1-14).
 *
 * `request_logs` la bang **nhay cam** — API doc chi tra ve **metadata**
 * (khong co `prompt_text` / `response_text` / `context_snapshot`).
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.16
 */

import { z } from 'zod'

/**
 * Tom tat 1 dong `request_logs` — **chi metadata**.
 *
 * KHONG co `promptText` / `responseText` / `contextSnapshot`: noi dung
 * nguoi dung khong bao gio di ra ngoai BFF qua endpoint nay.
 */
export const requestLogSummarySchema = z.object({
  /** Id dong trong DB. */
  id: z.string().uuid(),
  /** Request-id xuyen suot client → BFF → provider (NFR-MAINT-04). */
  requestId: z.string(),
  /** Conversation ma luot chat nay thuoc ve (neu co). */
  conversationId: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  /** Nguon API key: `K1` (team) · `K2` (BYOK qua BFF) · `K3` (local). */
  keySource: z.string(),
  /** Hash context da gui (khoa tai lap luot chat). */
  contextHash: z.string().nullable(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  /** Chi phi USD cua luot nay. */
  costUsd: z.number().nonnegative(),
  /** Thoi gian den token dau tien (ms). */
  ttftMs: z.number().int().nonnegative(),
  /** Tong thoi gian stream (ms). */
  latencyMs: z.number().int().nonnegative(),
  /** So tool call trong luot nay (M2 moi co tool that). */
  toolCallCount: z.number().int().nonnegative(),
  /** Error code neu luot chat that bai. */
  error: z.string().nullable(),
  createdAt: z.string(),
})
export type RequestLogSummary = z.infer<typeof requestLogSummarySchema>

/** Response cua `GET /api/logs`. */
export const logsResponseSchema = z.object({
  items: z.array(requestLogSummarySchema),
  /** Tong so dong khop bo loc (khong phai so dong trong page). */
  total: z.number().int().nonnegative(),
})
export type LogsResponse = z.infer<typeof logsResponseSchema>

/** Tong hop usage theo ngay. */
export const usageByDaySchema = z.object({
  /** Ngay theo ISO (`YYYY-MM-DD`). */
  date: z.string(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  /** So luot chat trong ngay do. */
  requests: z.number().int().nonnegative(),
})
export type UsageByDay = z.infer<typeof usageByDaySchema>

/** Response cua `GET /api/usage`. */
export const usageResponseSchema = z.object({
  totalTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  byDay: z.array(usageByDaySchema),
})
export type UsageResponse = z.infer<typeof usageResponseSchema>

/** So trang toi da cua `GET /api/logs`. */
export const LOGS_MAX_LIMIT = 200

/** Query params cua `GET /api/logs` — validate o bien (route handler). */
export const logsQuerySchema = z.object({
  /** So dong toi da tra ve (mac dinh 50). */
  limit: z.coerce.number().int().positive().max(LOGS_MAX_LIMIT).default(50),
  /** So dong bo qua (phan trang offset). */
  offset: z.coerce.number().int().nonnegative().default(0),
  /** Loc theo provider. */
  provider: z.string().min(1).max(50).optional(),
  /** Loc theo conversation. */
  conversationId: z.string().uuid().optional(),
  /** Tu thoi diem (ISO 8601) — inclusive. */
  from: z.string().datetime().optional(),
  /** Den thoi diem (ISO 8601) — inclusive. */
  to: z.string().datetime().optional(),
})
export type LogsQuery = z.infer<typeof logsQuerySchema>

/** Query params cua `GET /api/usage`. */
export const usageQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})
export type UsageQuery = z.infer<typeof usageQuerySchema>
