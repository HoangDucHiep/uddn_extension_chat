/**
 * Request logger — ghi log request vao console theo muc do.
 * KHONG bao gio log API key hay noi dung nhay cam.
 * Docs: docs/SYSTEM_DESIGN.md §6
 */

import type { RequestHandler } from 'express'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

/** Tao middleware log theo level. */
export function createRequestLogger(level: LogLevel): RequestHandler {
  const threshold = LEVEL_ORDER[level]

  return (req, res, next) => {
    const startedAt = Date.now()

    res.on('finish', () => {
      if (LEVEL_ORDER.info < threshold) return
      const durationMs = Date.now() - startedAt
      // Chi log method/path/status — khong log body (co the chua prompt/nguoi dung).
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`)
    })

    next()
  }
}
