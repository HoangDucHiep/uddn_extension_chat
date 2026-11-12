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
import { AppError, ERROR_CODES, PROVIDER_IDS, saveProviderKeySchema } from '@sidekick/shared'
import type { ProviderServiceDeps } from '../services/providerService.js'
import {
  deleteProviderKey,
  listProviderInfo,
  listProviderKeys,
  listProviderModels,
  saveProviderKey,
  testProviderKey,
} from '../services/providerService.js'

/**
 * Kiem tra id provider co hop le khong.
 *
 * Dung `PROVIDER_IDS` (nguon su that) thay vi `isProviderId` cua extension
 * (module phia client, khong dung o server).
 *
 * @param value - Gia tri can kiem tra.
 */
function isProviderId(value: string): value is (typeof PROVIDER_IDS)[number] {
  return (PROVIDER_IDS as readonly string[]).includes(value)
}

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
          message: `Không đọc được danh sách provider: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  /**
   * Danh sach model **dong** cua 1 provider (T-M2-02 — FR-PROVIDER-03).
   *
   * Phuc vu model picker trong side panel.
   */
  router.get('/providers/:id/models', async (req: Request, res: Response) => {
    const providerId = req.params['id']
    if (typeof providerId !== 'string' || !isProviderId(providerId)) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Provider không hợp lệ: "${String(providerId)}"`,
        },
      })
      return
    }

    try {
      const result = await listProviderModels(deps, providerId)
      res.status(200).json(result)
    } catch (error) {
      if (error instanceof AppError) throw error
      const message = error instanceof Error ? error.message : String(error)
      res.status(500).json({
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Không đọc được danh sách model: ${message.slice(0, 200)}`,
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
          message: `Không đọc được danh sách API key: ${message.slice(0, 200)}`,
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
          message: 'Dữ liệu API key không hợp lệ',
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
          message: `Không lưu được API key: ${message.slice(0, 200)}`,
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
          message: 'Thiếu id API key',
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
          message: `Không xoá được API key: ${message.slice(0, 200)}`,
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
          message: 'Thiếu id API key',
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
          message: `Không kiểm tra được API key: ${message.slice(0, 200)}`,
        },
      })
    }
  })

  return router
}
