/**
 * Entry point cua BFF.
 * Docs: docs/SYSTEM_DESIGN.md §4
 */

import { createApp } from './app.js'
import { getAllowedOrigins, getGeminiFallbackModels, getProviderFallbacks, loadEnv } from './config/env.js'
import { createDatabase } from './db/index.js'
import { ProviderRegistry } from './providers/registry.js'
import { createDefaultToolRegistry } from './tools/registry.js'
import { McpManager } from './tools/mcp/manager.js'
import { pruneRequestLogs } from './services/requestLogService.js'
import type { ProviderId } from '@sidekick/shared'

const VERSION = '0.1.0'

async function main(): Promise<void> {
  const env = loadEnv()
  const allowedOrigins = getAllowedOrigins(env)
  const { db, pool } = createDatabase(env.DATABASE_URL)

  const registry = new ProviderRegistry({
    defaultProvider: env.DEFAULT_PROVIDER,
    fallbacks: getProviderFallbacks(env) as ProviderId[],
    groqModel: env.GROQ_MODEL,
    openRouterModel: env.OPENROUTER_MODEL,
    geminiModel: env.GEMINI_MODEL,
    geminiFallbackModels: getGeminiFallbackModels(env),
    ollamaModel: env.OLLAMA_MODEL,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
  })

  const toolRegistry = createDefaultToolRegistry()
  // Manager MCP dung chung giua chat loop va API `/api/mcp/*` (T-M2-08).
  const mcpManager = new McpManager(toolRegistry)

  const app = createApp({
    db,
    pool,
    registry,
    toolRegistry,
    mcpManager,
    envKeys: {
      groq: env.GROQ_API_KEY,
      openrouter: env.OPENROUTER_API_KEY,
      gemini: env.GEMINI_API_KEY,
    },
    masterKey: env.MASTER_KEY,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    logFullContent: env.LOG_FULL_CONTENT,
    logRequests: env.LOG_REQUESTS,
    logContextSnapshot: env.LOG_CONTEXT_SNAPSHOT,
    logRetentionDays: env.LOG_RETENTION_DAYS,
    version: VERSION,
    allowedOrigins,
    logLevel: env.LOG_LEVEL,
    listProviders: () => registry.getFallbackChain(),
  })

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`Sidekick BFF v${VERSION} lắng nghe tại http://${env.HOST}:${env.PORT}`)
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
    console.log(`Provider chain: ${registry.getFallbackChain().join(' -> ')}`)
  })

  // Retention policy `request_logs` (§5.2): xoa dong cu hon 90 ngay.
  // Chay 1 lan luc khoi dong + lap lai moi 24h (T-M1-14).
  const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000

  const pruneLogs = (): void => {
    void pruneRequestLogs(db, env.LOG_RETENTION_DAYS)
      .then((deleted) => {
        if (deleted > 0) {
          console.log(`[retention] Đã xoá ${deleted} dòng request_logs quá hạn.`)
        }
      })
      .catch((error: unknown) => {
        // Xoa that bai khong duoc lam server chet.
        console.error(
          '[retention] không xoá được request_logs cũ:',
          error instanceof Error ? error.message : error,
        )
      })
  }

  pruneLogs()
  const pruneTimer = setInterval(pruneLogs, PRUNE_INTERVAL_MS)
  // Khong chan process ket thuc.
  pruneTimer.unref()

  // Tat sach: dong server truoc, dong pool sau.
  const shutdown = (signal: string): void => {
    console.log(`\nNhận ${signal}, đang tắt server...`)
    clearInterval(pruneTimer)
    // Dong process MCP server truoc khi tat (T-M2-08) → khong de treo process con.
    void mcpManager.disconnectAll().catch(() => undefined)
    server.close(() => {
      void pool.end().then(() => {
        console.log('Đã đóng kết nối DB.')
        process.exit(0)
      })
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  console.error('Không thể khởi động BFF:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
