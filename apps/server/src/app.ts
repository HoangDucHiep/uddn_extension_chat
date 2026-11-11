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
import { createRequestIdMiddleware } from './middleware/requestId.js'
import { createHealthRouter } from './routes/health.js'
import { createChatRouter } from './routes/chat.js'
import { createExtractRouter } from './routes/extract.js'
import { createAttachmentsRouter } from './routes/attachments.js'
import { createProvidersRouter } from './routes/providers.js'
import { createConversationsRouter } from './routes/conversations.js'
import { createLogsRouter } from './routes/logs.js'
import { createBudgetRouter } from './routes/budget.js'
import { createSkillsRouter } from './routes/skills.js'
import { createToolsRouter } from './routes/tools.js'
import { createMcpRouter } from './routes/mcp.js'
import { createDefaultToolRegistry } from './tools/registry.js'
import { McpManager } from './tools/mcp/manager.js'
import type { ChatServiceDeps } from './services/chatService.js'
import type { ProviderServiceDeps } from './services/providerService.js'

export interface AppDeps extends ChatServiceDeps, ProviderServiceDeps {
  pool: Pool
  version: string
  allowedOrigins: string[]
  logLevel: LogLevel
  listProviders: () => string[]
  /**
   * Manager MCP (FR-TOOLS-01 — T-M2-08).
   *
   * **Optional** → mac dinh manager rong (khong co MCP server nao).
   */
  mcpManager?: McpManager
}

export function createApp(deps: AppDeps): Express {
  const app = express()

  // Tin dung cac request den extension (side panel gui origin chrome-extension://).
  app.use(cors(createCorsOptions(deps.allowedOrigins)))
  // Chan origin la la -> 403 truoc khi vao handler.
  app.use(createOriginGuard(deps.allowedOrigins))
  // Gan request-id xuyen suot client → BFF (NFR-MAINT-04 — T-M1-14).
  // Phai chay TRUOC requestLogger de log co request-id.
  app.use(createRequestIdMiddleware())
  app.use(createRequestLogger(deps.logLevel))
  app.use(express.json({ limit: '16mb' }))

  const healthRouter = createHealthRouter(deps)
  const chatRouter = createChatRouter(deps)
  const extractRouter = createExtractRouter()
  const attachmentsRouter = createAttachmentsRouter({ db: deps.db })
  const providersRouter = createProvidersRouter(deps)
  const conversationsRouter = createConversationsRouter({ db: deps.db })
  const logsRouter = createLogsRouter({ db: deps.db })
  const budgetRouter = createBudgetRouter({ db: deps.db })
  const skillsRouter = createSkillsRouter({ db: deps.db })
  const toolsRouter = createToolsRouter({
    db: deps.db,
    ...(deps.toolRegistry !== undefined ? { toolRegistry: deps.toolRegistry } : {}),
  })
  const mcpRouter = createMcpRouter({
    db: deps.db,
    mcpManager:
      deps.mcpManager ??
      new McpManager(deps.toolRegistry ?? createDefaultToolRegistry()),
  })

  // `/api/health` la endpoint chinh; `/health` la alias de smoke test nhanh.
  app.use(API_BASE_PATH, healthRouter)
  app.use('/', healthRouter)
  app.use(API_BASE_PATH, chatRouter)
  app.use(API_BASE_PATH, extractRouter)
  app.use(API_BASE_PATH, attachmentsRouter)
  app.use(API_BASE_PATH, providersRouter)
  app.use(API_BASE_PATH, conversationsRouter)
  app.use(API_BASE_PATH, logsRouter)
  app.use(API_BASE_PATH, budgetRouter)
  app.use(API_BASE_PATH, skillsRouter)
  app.use(API_BASE_PATH, toolsRouter)
  app.use(API_BASE_PATH, mcpRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
