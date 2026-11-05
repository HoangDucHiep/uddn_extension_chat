/**
 * Route provider + BYOK key (K2).
 *
 *  - `GET    /api/providers`            — danh sach provider + trang thai key
 *  - `GET    /api/providers/keys`       — danh sach key da luu (chi metadata)
 *  - `POST   /api/providers/keys`       — luu key (ma hoa AES-256-GCM)
 *  - `DELETE /api/providers/keys/:id`  — xoa key
 *  - `POST   /api/providers/keys/:id/test` — kiem tra key co hoat dong
 *
 * **KHONG** bao gio tra key goc ra ngoai — chi `masked` (4 ky tu cuoi).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, FR-PROVIDER-02, FR-UX-02
 */

import { Router, type Request, type Response } from 'express'
import { AppError, ERROR_CODES, saveProviderKeySchema } from '@sidekick/shared'
import type { ProviderServiceDeps } from '../services/providerService.js'
import {
  deleteProviderKey,
  listProviderInfo,
  listProviderKeys,
  saveProviderKey,
  testProviderKey,
} from '../services/providerService.js'

export function createProvidersRouter(deps: ProviderServiceDeps): Router {
  const router = Router()

  /** Danh sach provider + trang thai key (K2 > K1 > none). */
  router.get('/providers', async (_req: Request, res: Response) => {
    try {
      const items = await listProviderInfo(deps)
      res.status(200).json({ items })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Khong doc duoc danh sach provider: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  /** Danh sach key da luu — chi metadata + key da che. */
  router.get('/providers/keys', async (_req: Request, res: Response) => {
    try {
      const items = await listProviderKeys(deps)
      res.status(200).json({ items })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Khong doc duoc danh sach API key: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  /** Luu API key (BYOK — K2). */
  router.post('/providers/keys', async (req: Request, res: Response) => {
    const parsed = saveProviderKeySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Du lieu API key khong hop le',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    try {
      const record = await saveProviderKey(deps, parsed.data)
      res.status(201).json(record)
    } catch (error) {
      if (error instanceof AppError) throw error
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Khong luu duoc API key: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  /** Xoa API key. */
  router.delete('/providers/keys/:id', async (req: Request, res: Response) => {
    const id = req.params['id']
    if (typeof id !== 'string' || id.length === 0) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Thieu id API key',
        },
      })
      return
    }

    try {
      await deleteProviderKey(deps, id)
      res.status(204).send()
    } catch (error) {
      if (error instanceof AppError) throw error
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Khong xoa duoc API key: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  /** Kiem tra API key co hoat dong khong. */
  router.post('/providers/keys/:id/test', async (req: Request, res: Response) => {
    const id = req.params['id']
    if (typeof id !== 'string' || id.length === 0) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Thieu id API key',
        },
      })
      return
    }

    try {
      const result = await testProviderKey(deps, id)
      res.status(200).json(result)
    } catch (error) {
      if (error instanceof AppError) throw error
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Khong kiem tra duoc API key: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  return router
}
