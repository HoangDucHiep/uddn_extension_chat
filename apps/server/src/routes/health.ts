/**
 * Route health — dung de smoke test va cho extension biet BFF con song.
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

import { Router } from 'express'
import type { Pool } from 'pg'
import { API_ROUTES } from '@sidekick/shared'
import { pingDatabase } from '../db/index.js'

export interface HealthDeps {
  pool: Pool
  version: string
  /** Danh sach provider id dang duoc config (de debug). */
  listProviders: () => string[]
}

export function createHealthRouter(deps: HealthDeps): Router {
  const router = Router()

  router.get('/health', async (_req, res) => {
    const dbUp = await pingDatabase(deps.pool)

    res.status(200).json({
      status: dbUp ? 'ok' : 'degraded',
      version: deps.version,
      db: dbUp ? 'up' : 'down',
      uptime: Math.round(process.uptime()),
      providers: deps.listProviders(),
    })
  })

  return router
}

export { API_ROUTES }
