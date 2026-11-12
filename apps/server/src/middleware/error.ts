/**
 * Error middleware — chuan hoa moi loi thanh response co `code` chuan.
 * Docs: docs/SYSTEM_DESIGN.md §4.1, packages/shared/src/errors.ts
 */

import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError, ERROR_CODES } from '@sidekick/shared'
import { ZodError } from 'zod'

/** 404 handler — route khong ton tai. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Khong tim thay endpoint ${req.method} ${req.path}`,
    },
  })
}

/** Error handler — moi loi ra ngoai deu di qua day. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(err.toBody())
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Du lieu gui len khong hop le',
        details: { issues: err.issues },
      },
    })
    return
  }

  // Loi la tu Express (body parser) — vi du JSON sai cu phap.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Body JSON khong hop le',
      },
    })
    return
  }

  // Body qua gioi han kich thuoc (`express.json({ limit })`) — vd tai lieu
  // dinh kem > 16 MB → 413 thay vi 500 (FR-CONTEXT-14 — T-M2-23).
  if (err instanceof Error && err.name === 'PayloadTooLargeError') {
    res.status(413).json({
      error: {
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: 'Body qua gioi han kich thuoc cho phep',
      },
    })
    return
  }

  // Khong log noi dung nhay cam — chi log message + stack.
  console.error('[error]', err instanceof Error ? err.message : String(err))
  if (err instanceof Error && err.stack) {
    console.error(err.stack)
  }

  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'Loi noi bo cua server',
    },
  })
}
