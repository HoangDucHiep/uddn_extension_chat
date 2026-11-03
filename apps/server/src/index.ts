/**
 * Entry point cua BFF.
 * Docs: docs/SYSTEM_DESIGN.md §4
 */

import { createApp } from './app.js'
import { getAllowedOrigins, loadEnv } from './config/env.js'
import { createDatabase } from './db/index.js'

const VERSION = '0.1.0'

async function main(): Promise<void> {
  const env = loadEnv()
  const allowedOrigins = getAllowedOrigins(env)
  const { pool } = createDatabase(env.DATABASE_URL)

  const app = createApp({
    pool,
    version: VERSION,
    allowedOrigins,
    logLevel: env.LOG_LEVEL,
    listProviders: () => [env.DEFAULT_PROVIDER, ...env.PROVIDER_FALLBACKS.split(',').filter(Boolean)],
  })

  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`Sidekick BFF v${VERSION} lang nghe tai http://${env.HOST}:${env.PORT}`)
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
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
