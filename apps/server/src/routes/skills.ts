/**
 * Route CRUD **skills** (FR-SKILL-01/02/03 — T-M2-04).
 *
 * - `GET /api/skills` → danh sach skill (built-in + cua user), loc `scope`/`q`.
 * - `POST /api/skills` → tao skill moi.
 * - `PATCH /api/skills/:id` → sua skill (chi skill cua user).
 * - `DELETE /api/skills/:id` → xoa skill (chi skill cua user).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.25
 */

import { Router, type Request, type Response } from 'express'
import {
  createSkillSchema,
  ERROR_CODES,
  skillListQuerySchema,
  updateSkillSchema,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import {
  createSkill,
  deleteSkill,
  listSkills,
  updateSkill,
} from '../services/skillService.js'

export interface SkillsDeps {
  db: Database
}

/**
 * Tao router skills.
 *
 * @param deps - Database client.
 */
export function createSkillsRouter(deps: SkillsDeps): Router {
  const router = Router()

  /** Danh sach skill (built-in truoc, sau do skill cua user). */
  router.get('/skills', async (req: Request, res: Response) => {
    const parsed = skillListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Query skill khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const items = await listSkills(deps.db, parsed.data)
    res.status(200).json({ items })
  })

  /** Tao skill moi (scope luon la `user`). */
  router.post('/skills', async (req: Request, res: Response) => {
    const parsed = createSkillSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body skill khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const created = await createSkill(deps.db, parsed.data)
    res.status(201).json(created)
  })

  /** Sua skill. */
  router.patch('/skills/:id', async (req: Request, res: Response) => {
    const parsed = updateSkillSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body skill khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const updated = await updateSkill(deps.db, skillId(req), parsed.data)
    res.status(200).json(updated)
  })

  /** Xoa skill. */
  router.delete('/skills/:id', async (req: Request, res: Response) => {
    await deleteSkill(deps.db, skillId(req))
    res.status(204).end()
  })

  return router
}

/**
 * Lay id skill tu path param (Express 5 → `string | string[] | undefined`).
 *
 * @param req - Request cua Express.
 * @returns Id skill.
 */
function skillId(req: Request): string {
  const raw = req.params['id']
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '')
}
