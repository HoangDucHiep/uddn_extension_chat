/**
 * Route CRUD conversation (FR-CHAT-08/09/11 — T-M1-09).
 *
 *  - `GET    /api/conversations`             — danh sach (loc `q`, tach `archived`)
 *  - `POST   /api/conversations`             — tao conversation moi
 *  - `GET    /api/conversations/:id/messages` — lich su + citations da luu
 *  - `PATCH  /api/conversations/:id`         — doi ten / ghim / luu tru
 *  - `DELETE /api/conversations/:id`         — xoa (cascade)
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.10
 */

import { Router, type Request, type Response } from 'express'
import {
  activateVariantSchema,
  conversationListQuerySchema,
  createConversationSchema,
  ERROR_CODES,
  updateConversationSchema,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import {
  activateVariant,
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations,
  updateConversation,
} from '../services/conversationService.js'

export interface ConversationsRouterDeps {
  db: Database
}

/** Regex UUID (v4) — dung de chan id khong hop le truoc khi query DB. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createConversationsRouter(deps: ConversationsRouterDeps): Router {
  const router = Router()

  /** Danh sach conversation. */
  router.get('/conversations', async (req: Request, res: Response) => {
    const parsed = conversationListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Query danh sach cuoc tro chuyen khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const result = await listConversations(deps.db, {
      q: parsed.data.q,
      archived: parsed.data.archived,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    })

    res.status(200).json({
      items: result.items,
      ...(result.nextCursor !== undefined ? { nextCursor: result.nextCursor } : {}),
    })
  })

  /** Tao conversation moi. */
  router.post('/conversations', async (req: Request, res: Response) => {
    const parsed = createConversationSchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body tao cuoc tro chuyen khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const conversation = await createConversation(deps.db, parsed.data.title)
    res.status(201).json(conversation)
  })

  /** Lich su hoi thoai cua 1 conversation (kem citations da luu). */
  router.get('/conversations/:id/messages', async (req: Request, res: Response) => {
    const id = req.params['id']
    if (!isUuid(id)) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Id cuoc tro chuyen khong hop le',
        },
      })
      return
    }

    const result = await getConversationMessages(deps.db, id)
    res.status(200).json(result)
  })

  /** Doi bien the active cua 1 turn (FR-CHAT-05 — T-M1-10). */
  router.post(
    '/conversations/:id/turns/:turnId/activate',
    async (req: Request, res: Response) => {
      const id = req.params['id']
      const rawTurnId = req.params['turnId']
      if (!isUuid(id)) {
        res.status(400).json({
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Id cuoc tro chuyen khong hop le',
          },
        })
        return
      }
      const turnId = typeof rawTurnId === 'string' ? rawTurnId : ''
      if (turnId.length === 0) {
        res.status(400).json({
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Id luot hoi dap khong hop le',
          },
        })
        return
      }

      const parsed = activateVariantSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Body kich hoat bien the khong hop le',
            details: { issues: parsed.error.issues },
          },
        })
        return
      }

      const result = await activateVariant(deps.db, id, turnId, parsed.data.variantIndex)
      res.status(200).json(result)
    },
  )

  /** Doi ten / ghim / luu tru. */
  router.patch('/conversations/:id', async (req: Request, res: Response) => {
    const id = req.params['id']
    if (!isUuid(id)) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Id cuoc tro chuyen khong hop le',
        },
      })
      return
    }

    const parsed = updateConversationSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body cap nhat cuoc tro chuyen khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const conversation = await updateConversation(deps.db, id, parsed.data)
    res.status(200).json(conversation)
  })

  /** Xoa conversation. */
  router.delete('/conversations/:id', async (req: Request, res: Response) => {
    const id = req.params['id']
    if (!isUuid(id)) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Id cuoc tro chuyen khong hop le',
        },
      })
      return
    }

    await deleteConversation(deps.db, id)
    res.status(204).send()
  })

  return router
}

/**
 * Kiem tra id co phai UUID hop le khong.
 *
 * Express 5 kieu param la `string | string[] | undefined` → can chuan hoa
 * truoc khi so sanh.
 *
 * @param value - Gia tri can kiem tra.
 */
function isUuid(value: string | string[] | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}
