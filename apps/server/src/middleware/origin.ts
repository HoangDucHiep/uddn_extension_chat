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

/** Wildcard origin — cho phep moi extension id cua Chrome. */
const WILDCARD_ORIGIN = '*'

/**
 * Kiem tra origin co khop 1 entry trong allowlist khong.
 * Entry co the la origin cu (vd `http://localhost:5173`) hoac wildcard
 * theo scheme (vd `chrome-extension://*`).
 *
 * Wildcard theo scheme duoc dung cho `chrome-extension://*`: id cua extension
 * load unpacked thay doi theo may nen can cho phep ca scheme. Day KHONG
 * mo rong cho web page — browser khong cho web page tu dat Origin
 * `chrome-extension://...`.
 */
function matchesOrigin(origin: string, allowed: string): boolean {
  if (allowed === WILDCARD_ORIGIN) return true
  if (allowed === origin) return true

  if (allowed.endsWith('://*')) {
    const scheme = allowed.slice(0, allowed.indexOf('://'))
    return origin.startsWith(`${scheme}://`)
  }

  return false
}

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

    const permitted = [...allowed].some((entry) => matchesOrigin(origin, entry))
    if (permitted) {
      next()
      return
    }

    res.status(403).json({
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: `Origin không được phép: ${origin}`,
      },
    })
  }
}

/**
 * CORS config — chi cho phep origin cu the, khong dung `*`.
 * `credentials: false` vi BFF khong dung cookie.
 *
 * Dung function de ho tro wildcard theo scheme (`chrome-extension://*`).
 */
export function createCorsOptions(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins)

  return {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ): void => {
      // Request khong co Origin (curl, server-to-server) -> cho qua.
      if (typeof origin !== 'string' || origin.length === 0) {
        callback(null, true)
        return
      }

      const permitted = [...allowed].some((entry) => matchesOrigin(origin, entry))
      callback(null, permitted)
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    // `X-Request-Id` phai duoc allow de client gui request-id xuyen suot
    // (NFR-MAINT-04 — T-M1-14).
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', CLIENT_HEADER, 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }
}
