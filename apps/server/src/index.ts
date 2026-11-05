/**
 * Entry point cua BFF.
 * Docs: docs/SYSTEM_DESIGN.md §4
 */

import { createApp } from './app.js'
import { getAllowedOrigins, getGeminiFallbackModels, getProviderFallbacks, loadEnv } from './config/env.js'
import { createDatabase } from './db/index.js'
import { ProviderRegistry } from './providers/registry.js'
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

  const app = createApp({
    db,
    pool,
    registry,
    envKeys: {
      groq: env.GROQ_API_KEY,
      openrouter: env.OPENROUTER_API_KEY,
      gemini: env.GEMINI_API_KEY,
    },
    masterKey: env.MASTER_KEY,
    ollamaBaseUrl: env.OLLAMA_BASE_URL,
    logFullContent: false,
    logRequests: env.LOG_REQUESTS,
    logContextSnapshot: env.LOG_CONTEXT_SNAPSHOT,
    version: VERSION,
    allowedOrigins,
    logLevel: env.LOG_LEVEL,
    listProviders: () => registry.getFallbackChain(),
  })

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`Sidekick BFF v${VERSION} lang nghe tai http://${env.HOST}:${env.PORT}`)
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
    console.log(`Provider chain: ${registry.getFallbackChain().join(' -> ')}`)
  })

  // Tat sach: dong server truoc, dong pool sau.
  const shutdown = (signal: string): void => {
    console.log(`\nNhan ${signal}, dang tat server...`)
    server.close(() => {
      void pool.end().then(() => {
        console.log('Da dong ket noi DB.')
        process.exit(0)
      })
    })
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error: unknown) => {
  console.error('Khong the khoi dong BFF:', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
