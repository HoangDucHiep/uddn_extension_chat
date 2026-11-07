/**
 * Request logger — ghi log request theo **JSON** (NFR-MAINT-04).
 *
 * KHONG bao gio log API key hay noi dung nhay cam. Chi ghi:
 * method · path · status · duration · request-id.
 *
 * Docs: docs/SYSTEM_DESIGN.md §6, §7.16
 */

import type { RequestHandler } from 'express'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/**
 * Shape cua 1 dong log JSON.
 *
 * `event` cho phep phan biet cac loai log khi grep theo log aggregator.
 */
export interface HttpLogEntry {
  /** ISO timestamp. */
  ts: string
  level: LogLevel
  event: 'http_request'
  /** Request-id xuyen suot client → BFF → provider. */
  requestId: string
  method: string
  path: string
  status: number
  durationMs: number
}

/**
 * Tao duong dan log JSON (1 dong = 1 object JSON).
 *
 * @param entry - Du lieu can ghi.
 */
export function formatHttpLogEntry(entry: HttpLogEntry): string {
  return JSON.stringify(entry)
}

/**
 * Tao middleware log request theo level.
 *
 * Log o dang **JSON** (1 dong/request) de log collector (Docker `json-file`
 * driver, Loki, ...) parse duoc ma khong can regex.
 */
export function createRequestLogger(level: LogLevel): RequestHandler {
  const threshold = LEVEL_ORDER[level]

  return (req, res, next) => {
    const startedAt = Date.now()

    res.on('finish', () => {
      if (LEVEL_ORDER.info < threshold) return
      const durationMs = Date.now() - startedAt
      const entry: HttpLogEntry = {
        ts: new Date().toISOString(),
        level: 'info',
        event: 'http_request',
        // Middleware `requestId` chay **truoc** middleware nay trong `app.ts`
        // → `sidekickRequestId` luon co gia tri.
        requestId: req.sidekickRequestId ?? 'unknown',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
      }
      // Chi log method/path/status — khong log body (co the chua prompt/nguoi dung).
      console.log(formatHttpLogEntry(entry))
    })

    next()
  }
}
