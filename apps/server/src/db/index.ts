/**
 * Ket noi Postgres + Drizzle.
 * Docs: docs/SYSTEM_DESIGN.md §5
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

/** Kieu database Drizzle cua Sidekick AI. */
export type Database = NodePgDatabase<typeof schema>

export interface DatabaseClient {
  db: Database
  pool: Pool
}

/** Tao Pool + Drizzle client. Caller chiu responsible dong pool. */
export function createDatabase(connectionString: string, maxConnections = 10): DatabaseClient {
  const pool = new Pool({
    connectionString,
    max: maxConnections,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

  const db = drizzle(pool, { schema })
  return { db, pool }
}

/** Kiem tra DB co phan hoi hay khong (dung cho /api/health). */
export async function pingDatabase(pool: Pool): Promise<boolean> {
  try {
    await pool.query('SELECT 1')
    return true
  } catch {
    return false
  }
}
