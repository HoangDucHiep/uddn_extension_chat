/**
 * Route anh dinh kem — `GET /api/attachments/:id`.
 *
 * Tra ve **binary** (khong phai JSON) de panel render `<img src=...>` truc tiep.
 * Anh duoc luu trong bang `message_attachments` (FR-VISION-01 — T-M1-24).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.2
 */

import { Router, type Request, type Response } from 'express'
import { ERROR_CODES } from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { getAttachment } from '../services/attachmentService.js'

export interface AttachmentsRouterDeps {
  db: Database
}

export function createAttachmentsRouter(deps: AttachmentsRouterDeps): Router {
  const router = Router()

  router.get('/attachments/:id', async (req: Request, res: Response) => {
    const id = req.params['id']
    if (typeof id !== 'string' || id.length === 0) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Thiếu id ảnh đính kèm',
        },
      })
      return
    }

    try {
      const attachment = await getAttachment(deps.db, id)

      if (attachment === undefined) {
        res.status(404).json({
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: 'Không tìm thấy ảnh đính kèm',
          },
        })
        return
      }

      res.setHeader('Content-Type', attachment.mimeType)
      res.setHeader('Cache-Control', 'private, max-age=3600')
      res.setHeader('Content-Length', String(attachment.data.byteLength))
      res.status(200).send(attachment.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Không đọc được ảnh đính kèm: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  return router
}
