/**
 * Origin allowlist + CORS.
 *
 * BFF chi nhan request tu extension (origin `chrome-extension://<id>`) hoac
 * dev server cua Vite. Origin khong trong danh sach -> 403.
 * Docs: docs/SYSTEM_DESIGN.md §6.2
 */

import type { RequestHandler } from 'express'
import { ERROR_CODES } from '@sidekick/shared'

/** Header client tu gui de BFF nhan biet app nao goi (fallback khi khong co Origin). */
export const CLIENT_HEADER = 'x-sidekick-client'

/**
 * Tao middleware kiem tra Origin.
 * `allowedOrigins` da duoc chuan hoa o config/env.ts.
 */
export function createOriginGuard(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins)

  return (req, res, next) => {
    // Request khong co Origin (vi du curl, server-to-server) -> cho qua.
    // Browser luon gui Origin cho cross-origin request.
    const origin = req.headers.origin

    if (typeof origin !== 'string' || origin.length === 0) {
      next()
      return
    }

    if (allowed.has(origin)) {
      next()
      return
    }

    res.status(403).json({
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: `Origin khong duoc phep: ${origin}`,
      },
    })
  }
}

/**
 * CORS config — chi cho phep origin cu the, khong dung `*`.
 * `credentials: false` vi BFF khong dung cookie.
 */
export function createCorsOptions(allowedOrigins: string[]) {
  return {
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', CLIENT_HEADER],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }
}
