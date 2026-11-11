/**
 * Route quan ly **tool** (FR-TOOLS-01/04 — T-M2-07/09).
 *
 * - `GET /api/tools` → danh sach tool server dang co (ten, mo ta, can duyet khong).
 * - `POST /api/tools/:callId/approve` → nguoi dung duyet 1 tool call.
 * - `POST /api/tools/:callId/deny` → nguoi dung tu choi 1 tool call.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.26
 */

import { Router, type Request, type Response } from 'express'
import { ERROR_CODES } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { setToolCallApproval } from '../services/toolCallService.js'
import { createDefaultToolRegistry, type ToolRegistry } from '../tools/registry.js'

export interface ToolsDeps {
  db: Database
  /** Registry tool — optional → mac dinh chi co `calculator`. */
  toolRegistry?: ToolRegistry
}

/**
 * Tao router tools.
 *
 * @param deps - Database + registry tool.
 */
export function createToolsRouter(deps: ToolsDeps): Router {
  const router = Router()
  const toolRegistry = deps.toolRegistry ?? createDefaultToolRegistry()

  /** Danh sach tool dang co. */
  router.get('/tools', (_req: Request, res: Response) => {
    const items = toolRegistry.listEnabled().map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiresApproval: tool.requiresApproval,
    }))
    res.status(200).json({ items })
  })

  /** Duyet 1 tool call (FR-TOOLS-04 — T-M2-09). */
  router.post('/tools/:callId/approve', async (req: Request, res: Response) => {
    const updated = await setToolCallApproval(deps.db, toolCallId(req), true)
    if (updated === undefined) {
      res.status(404).json({
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Khong tim thay tool call',
        },
      })
      return
    }
    res.status(200).json({ id: updated.id, approvedByUser: updated.approvedByUser })
  })

  /** Tu choi 1 tool call (FR-TOOLS-04 — T-M2-09). */
  router.post('/tools/:callId/deny', async (req: Request, res: Response) => {
    const updated = await setToolCallApproval(deps.db, toolCallId(req), false)
    if (updated === undefined) {
      res.status(404).json({
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Khong tim thay tool call',
        },
      })
      return
    }
    res.status(200).json({ id: updated.id, approvedByUser: updated.approvedByUser })
  })

  return router
}

/**
 * Lay id tool call tu path param (Express 5 → `string | string[] | undefined`).
 *
 * @param req - Request cua Express.
 * @returns Id tool call.
 */
function toolCallId(req: Request): string {
  const raw = req.params['callId']
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
}
