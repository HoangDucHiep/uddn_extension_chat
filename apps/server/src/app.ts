/**
 * Express app — compose middleware + routes.
 * Docs: docs/SYSTEM_DESIGN.md §4
 */

import cors from 'cors'
import express, { type Express } from 'express'
import type { Pool } from 'pg'
import { API_BASE_PATH } from '@sidekick/shared'
import { createCorsOptions, createOriginGuard } from './middleware/origin.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { createRequestLogger, type LogLevel } from './middleware/requestLogger.js'
import { createHealthRouter } from './routes/health.js'
import { createChatRouter } from './routes/chat.js'
import type { ChatServiceDeps } from './services/chatService.js'

export interface AppDeps extends ChatServiceDeps {
  pool: Pool
  version: string
  allowedOrigins: string[]
  logLevel: LogLevel
  listProviders: () => string[]
}

export function createApp(deps: AppDeps): Express {
  const app = express()

  // Tin dung cac request den extension (side panel gui origin chrome-extension://).
  app.use(cors(createCorsOptions(deps.allowedOrigins)))
  // Chan origin la la -> 403 truoc khi vao handler.
  app.use(createOriginGuard(deps.allowedOrigins))
  app.use(createRequestLogger(deps.logLevel))
  app.use(express.json({ limit: '2mb' }))

  const healthRouter = createHealthRouter(deps)
  const chatRouter = createChatRouter(deps)

  // `/api/health` la endpoint chinh; `/health` la alias de smoke test nhanh.
  app.use(API_BASE_PATH, healthRouter)
  app.use('/', healthRouter)
  app.use(API_BASE_PATH, chatRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
