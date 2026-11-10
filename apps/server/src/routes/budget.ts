/**
 * Route budget cap (FR-PROVIDER-06 — T-M2-03b).
 *
 * - `GET /api/budget` → trang thai budget hien tai (cau hinh + chi phi da dung).
 * - `PUT /api/budget` → luu cau hinh moi (validate Zod o bien).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

import { Router, type Request, type Response } from 'express'
import {
  budgetSettingsPatchSchema,
  budgetSettingsSchema,
  ERROR_CODES,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import {
  buildBudgetStatus,
  readBudgetSettings,
  writeBudgetSettings,
} from '../services/budgetService.js'

export interface BudgetDeps {
  db: Database
}

/**
 * Tao router budget cap.
 *
 * @param deps - Database client.
 */
export function createBudgetRouter(deps: BudgetDeps): Router {
  const router = Router()

  /** Trang thai budget hien tai. */
  router.get('/budget', async (_req: Request, res: Response) => {
    const status = await buildBudgetStatus(deps.db)
    res.status(200).json(status)
  })

  /** Luu cau hinh budget moi. */
  router.put('/budget', async (req: Request, res: Response) => {
    const parsed = budgetSettingsPatchSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body budget khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    // Merge patch vao cau hinh hien tai → validate **day du** truoc khi ghi.
    const current = await readBudgetSettings(deps.db)
    const merged = budgetSettingsSchema.safeParse({ ...current, ...parsed.data })
    if (!merged.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body budget khong hop le',
          details: { issues: merged.error.issues },
        },
      })
      return
    }

    await writeBudgetSettings(deps.db, merged.data)
    const status = await buildBudgetStatus(deps.db)
    res.status(200).json(status)
  })

  return router
}
