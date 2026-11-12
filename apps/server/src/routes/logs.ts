/**
 * Route logs — doc `request_logs` (chi metadata) + tong hop usage (T-M1-14).
 *
 * KHONG tra ve `prompt_text` / `response_text` / `context_snapshot` →
 * noi dung nguoi dung khong bao gio di ra ngoai qua endpoint nay.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.16
 */

import { Router, type Request, type Response } from 'express'
import { ERROR_CODES, logsQuerySchema, usageQuerySchema } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { aggregateUsage, listRequestLogs } from '../services/requestLogService.js'

export interface LogsDeps {
  db: Database
}

/**
 * Tao router doc log + usage.
 *
 * @param deps - Database client.
 */
export function createLogsRouter(deps: LogsDeps): Router {
  const router = Router()

  /** Danh sach log (chi metadata). */
  router.get('/logs', async (req: Request, res: Response) => {
    const parsed = logsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Query logs không hợp lệ',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const { limit, offset, provider, conversationId, from, to } = parsed.data

    const result = await listRequestLogs(deps.db, {
      limit,
      offset,
      ...(provider !== undefined ? { provider } : {}),
      ...(conversationId !== undefined ? { conversationId } : {}),
      ...(from !== undefined ? { from: new Date(from) } : {}),
      ...(to !== undefined ? { to: new Date(to) } : {}),
    })

    res.status(200).json(result)
  })

  /** Tong hop token + chi phi theo ngay. */
  router.get('/usage', async (req: Request, res: Response) => {
    const parsed = usageQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Query usage không hợp lệ',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const { from, to } = parsed.data

    const usage = await aggregateUsage(deps.db, {
      ...(from !== undefined ? { from: new Date(from) } : {}),
      ...(to !== undefined ? { to: new Date(to) } : {}),
    })

    res.status(200).json(usage)
  })

  return router
}
