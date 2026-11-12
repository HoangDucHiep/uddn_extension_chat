/**
 * Client doc `request_logs` tu BFF cho eval harness (T-M1-14).
 *
 * Dung khi can so lieu **chi phi / token / ttft / latency** cua cac luot
 * chat da chay — nguon su that la dong `request_logs` trong Postgres
 * (khong phai uoc luong lai tu client).
 *
 * Docs: docs/EVAL_PLAN.md §5.3, docs/SYSTEM_DESIGN.md §4.1
 */

import {
  logsResponseSchema,
  usageResponseSchema,
  type LogsResponse,
  type RequestLogSummary,
  type UsageResponse,
} from '@sidekick/shared'

/** Tham so cua `GET /api/logs`. */
export interface FetchLogsParams {
  /** So dong toi da tra ve. */
  limit?: number
  /** So dong bo qua. */
  offset?: number
  /** Loc theo provider. */
  provider?: string
  /** Loc theo conversation. */
  conversationId?: string
  /** Tu thoi diem (ISO 8601). */
  from?: string
  /** Den thoi diem (ISO 8601). */
  to?: string
}

/**
 * Tao query string tu tham so (bo qua gia tri undefined).
 *
 * @param params - Tham so can chuyen.
 */
function toQuery(params: FetchLogsParams): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query.length > 0 ? `?${query}` : ''
}

/**
 * Doc danh sach log (chi metadata).
 *
 * @param baseUrl - Base URL cua BFF (vd `http://127.0.0.1:8787`).
 * @param params - Bo loc + phan trang.
 */
export async function fetchLogs(
  baseUrl: string,
  params: FetchLogsParams = {},
): Promise<LogsResponse> {
  const response = await fetch(`${baseUrl}/api/logs${toQuery(params)}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`GET /api/logs thất bại: HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  return logsResponseSchema.parse(payload)
}

/**
 * Doc tong hop usage (token + chi phi theo ngay).
 *
 * @param baseUrl - Base URL cua BFF.
 * @param params - Khoang thoi gian.
 */
export async function fetchUsage(
  baseUrl: string,
  params: { from?: string; to?: string } = {},
): Promise<UsageResponse> {
  const response = await fetch(`${baseUrl}/api/usage${toQuery(params)}`, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`GET /api/usage thất bại: HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  return usageResponseSchema.parse(payload)
}

/**
 * Tinh cac chi so tong hop tu danh sach log.
 *
 * Dung de in report nhanh ma khong can goi `/api/usage` (chi de doi chieu).
 *
 * @param items - Danh sach log.
 */
export function summarizeLogs(items: readonly RequestLogSummary[]): {
  requests: number
  errors: number
  tokensIn: number
  tokensOut: number
  costUsd: number
  avgTtftMs: number
  avgLatencyMs: number
} {
  const errors = items.filter((item) => item.error !== null).length
  const tokensIn = items.reduce((sum, item) => sum + item.tokensIn, 0)
  const tokensOut = items.reduce((sum, item) => sum + item.tokensOut, 0)
  const costUsd = Number(items.reduce((sum, item) => sum + item.costUsd, 0).toFixed(6))
  const avgTtftMs =
    items.length === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.ttftMs, 0) / items.length)
  const avgLatencyMs =
    items.length === 0
      ? 0
      : Math.round(items.reduce((sum, item) => sum + item.latencyMs, 0) / items.length)

  return {
    requests: items.length,
    errors,
    tokensIn,
    tokensOut,
    costUsd,
    avgTtftMs,
    avgLatencyMs,
  }
}
