/**
 * Route quan ly **MCP server** (FR-TOOLS-01 — T-M2-08).
 *
 * - `GET /api/mcp/servers` → danh sach MCP server + trang thai ket noi.
 * - `POST /api/mcp/servers` → them MCP server (server connect thu ngay).
 * - `PATCH /api/mcp/servers/:id` → sua cau hinh.
 * - `DELETE /api/mcp/servers/:id` → xoa + disconnect.
 * - `POST /api/mcp/servers/:id/reconnect` → ket noi lai.
 * - `GET /api/mcp/tools` → danh sach tool MCP dang expose cho model.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.27
 */

import { Router, type Request, type Response } from 'express'
import {
  createMcpServerSchema,
  ERROR_CODES,
  updateMcpServerSchema,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import {
  createMcpServer,
  deleteMcpServer,
  listMcpServersWithState,
  reconnectMcpServer,
  updateMcpServer,
} from '../services/mcpService.js'
import type { McpManager } from '../tools/mcp/manager.js'

export interface McpDeps {
  db: Database
  /** Manager MCP (spawn process + dong bo tool). */
  mcpManager: McpManager
}

/**
 * Tao router MCP.
 *
 * @param deps - Database + manager MCP.
 */
export function createMcpRouter(deps: McpDeps): Router {
  const router = Router()

  /** Danh sach MCP server + trang thai runtime. */
  router.get('/mcp/servers', async (_req: Request, res: Response) => {
    const items = await listMcpServersWithState(deps.db, deps.mcpManager)
    res.status(200).json({ items })
  })

  /** Tool MCP dang expose cho model. */
  router.get('/mcp/tools', (_req: Request, res: Response) => {
    res.status(200).json({ items: deps.mcpManager.listTools() })
  })

  /** Them MCP server moi. */
  router.post('/mcp/servers', async (req: Request, res: Response) => {
    const parsed = createMcpServerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body MCP server không hợp lệ',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const created = await createMcpServer(deps.db, parsed.data, deps.mcpManager)
    res.status(201).json(created)
  })

  /** Sua cau hinh MCP server. */
  router.patch('/mcp/servers/:id', async (req: Request, res: Response) => {
    const parsed = updateMcpServerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body MCP server không hợp lệ',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const updated = await updateMcpServer(
      deps.db,
      mcpServerId(req),
      parsed.data,
      deps.mcpManager,
    )
    res.status(200).json(updated)
  })

  /** Xoa MCP server. */
  router.delete('/mcp/servers/:id', async (req: Request, res: Response) => {
    await deleteMcpServer(deps.db, mcpServerId(req), deps.mcpManager)
    res.status(204).end()
  })

  /** Ket noi lai MCP server. */
  router.post('/mcp/servers/:id/reconnect', async (req: Request, res: Response) => {
    const result = await reconnectMcpServer(deps.db, mcpServerId(req), deps.mcpManager)
    if (result === undefined) {
      res.status(404).json({
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: 'Không tìm thấy MCP server',
        },
      })
      return
    }

    res.status(200).json({
      id: result.id,
      status: result.status,
      toolCount: result.toolCount,
      ...(result.lastError !== undefined ? { error: result.lastError } : {}),
    })
  })

  return router
}

/**
 * Lay id MCP server tu path param (Express 5 → `string | string[] | undefined`).
 *
 * @param req - Request cua Express.
 * @returns Id server.
 */
function mcpServerId(req: Request): string {
  const raw = req.params['id']
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
}
