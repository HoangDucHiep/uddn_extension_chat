/**
 * Service **MCP server** (FR-TOOLS-01 — T-M2-08).
 *
 * ## Trach nhiem
 *
 * - Doc/ghi cau hinh MCP server trong bang `mcp_servers` (Postgres).
 * - Dong bo trang thai runtime tu `McpManager` (spawn process, tien trinh).
 * - Cap nhat `last_connected_at` / `last_error` de Settings hien thi.
 *
 * ## Vi sao tach service rieng?
 *
 * Route chi validate + tra response; business logic (spawn, namespace, ton tai)
 * nam o day → test duoc khong can HTTP server.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.4
 */

import { asc, eq } from 'drizzle-orm'
import {
  AppError,
  ERROR_CODES,
  MCP_LIMITS,
  type CreateMcpServerInput,
  type McpServer,
  type UpdateMcpServerInput,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { mcpServers } from '../db/schema.js'
import type { McpManager, ManagedMcpServer } from '../tools/mcp/manager.js'
import type { McpServerConfig } from '../tools/mcp/manager.js'

/**
 * Chuyen dong DB thanh cau hinh cho `McpManager`.
 *
 * @param row - Dong tu bang `mcp_servers`.
 * @returns Cau hinh da rut gon.
 */
export function toMcpServerConfig(row: {
  id: string
  name: string
  command: string
  args: string[]
  env: unknown
  enabled: boolean
  autoApprove: boolean
}): McpServerConfig {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    args: row.args,
    env: toEnvRecord(row.env),
    enabled: row.enabled,
    autoApprove: row.autoApprove,
  }
}

/**
 * Chuyen gia tri `jsonb` cua dong DB thanh record bien moi truong.
 *
 * `jsonb` trong Drizzle duoc khai bao la `unknown` → phai **narrow** lai.
 *
 * @param value - Gia tri raw tu DB.
 * @returns Record bien moi truong (rong neu khong hop le).
 */
function toEnvRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') result[key] = item
  }
  return result
}

/**
 * Chuyen dong DB thanh contract `McpServer` (chua kem trang thai runtime).
 *
 * @param row - Dong tu bang `mcp_servers`.
 * @returns Server da chuan hoa.
 */
function toMcpServer(row: {
  id: string
  name: string
  transport: string
  command: string
  args: string[]
  env: unknown
  enabled: boolean
  autoApprove: boolean
  lastConnectedAt: Date | null
  lastError: string | null
}): McpServer {
  return {
    id: row.id,
    name: row.name,
    transport: 'stdio',
    command: row.command,
    args: [...row.args],
    env: toEnvRecord(row.env),
    enabled: row.enabled,
    autoApprove: row.autoApprove,
    status: 'disconnected',
    toolCount: 0,
    ...(row.lastError !== null && row.lastError.length > 0 ? { lastError: row.lastError } : {}),
    ...(row.lastConnectedAt !== null
      ? { lastConnectedAt: row.lastConnectedAt.toISOString() }
      : {}),
  }
}

/**
 * Doc tat ca MCP server tu DB.
 *
 * @param db - Database client.
 * @returns Danh sach server (theo ten tang dan).
 */
export async function listMcpServerRows(db: Database): Promise<McpServer[]> {
  const rows = await db.select().from(mcpServers).orderBy(asc(mcpServers.name))
  return rows.map(toMcpServer)
}

/**
 * Doc cau hinh raw (cho `McpManager`).
 *
 * @param db - Database client.
 * @returns Danh sach cau hinh.
 */
export async function listMcpServerConfigs(db: Database): Promise<McpServerConfig[]> {
  const rows = await db.select().from(mcpServers).orderBy(asc(mcpServers.name))
  return rows.map(toMcpServerConfig)
}

/**
 * Lay 1 MCP server theo id.
 *
 * @param db - Database client.
 * @param id - Id server.
 * @returns Server hoac `undefined`.
 */
export async function getMcpServer(
  db: Database,
  id: string,
): Promise<McpServer | undefined> {
  const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1)
  const row = rows[0]
  if (row === undefined) return undefined
  return toMcpServer(row)
}

/**
 * Kiem tra ten MCP server da ton tai chua.
 *
 * @param db - Database client.
 * @param name - Ten can kiem tra.
 * @param excludeId - Id server duoc bo qua (khi update).
 * @returns `true` neu ten da ton tai.
 */
async function nameExists(
  db: Database,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: mcpServers.id })
    .from(mcpServers)
    .where(eq(mcpServers.name, name))

  return rows.some((row) => row.id !== excludeId)
}

/**
 * Tao MCP server moi + thu connect.
 *
 * @param db - Database client.
 * @param input - Du lieu server (da qua Zod o bien).
 * @param manager - Manager MCP (de spawn + dong bo tool).
 * @returns Server da tao (voi trang thai runtime).
 */
export async function createMcpServer(
  db: Database,
  input: CreateMcpServerInput,
  manager: McpManager,
): Promise<McpServer> {
  if (await nameExists(db, input.name)) {
    throw new AppError(ERROR_CODES.CONFLICT, `MCP server "${input.name}" da ton tai`)
  }

  const existingCount = await db.select({ id: mcpServers.id }).from(mcpServers)
  if (existingCount.length >= MCP_LIMITS.MAX_SERVERS) {
    throw new AppError(
      ERROR_CODES.BAD_REQUEST,
      `Chi toi da ${MCP_LIMITS.MAX_SERVERS} MCP server`,
    )
  }

  const rows = await db
    .insert(mcpServers)
    .values({
      name: input.name,
      transport: input.transport,
      command: input.command,
      args: input.args,
      env: input.env,
      enabled: input.enabled,
      autoApprove: input.autoApprove,
    })
    .returning()

  const row = rows[0]
  if (row === undefined) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Khong tao duoc MCP server')
  }

  await manager.refresh([...(await listMcpServerConfigs(db))], { force: true })
  await syncRuntimeState(db, manager)

  const server = await getMcpServer(db, row.id)
  if (server === undefined) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Khong tao duoc MCP server')
  }
  return server
}

/**
 * Cap nhat MCP server + ket noi lai neu cau hinh thay doi.
 *
 * @param db - Database client.
 * @param id - Id server.
 * @param patch - Truong can doi.
 * @param manager - Manager MCP.
 * @returns Server sau khi cap nhat.
 */
export async function updateMcpServer(
  db: Database,
  id: string,
  patch: UpdateMcpServerInput,
  manager: McpManager,
): Promise<McpServer> {
  const current = await getMcpServer(db, id)
  if (current === undefined) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay MCP server')
  }

  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.command !== undefined) values['command'] = patch.command
  if (patch.args !== undefined) values['args'] = patch.args
  if (patch.env !== undefined) values['env'] = patch.env
  if (patch.enabled !== undefined) values['enabled'] = patch.enabled
  if (patch.autoApprove !== undefined) values['autoApprove'] = patch.autoApprove

  const rows = await db
    .update(mcpServers)
    .set(values)
    .where(eq(mcpServers.id, id))
    .returning()

  if (rows[0] === undefined) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay MCP server')
  }

  await manager.refresh([...(await listMcpServerConfigs(db))], { force: true })
  await syncRuntimeState(db, manager)

  const server = await getMcpServer(db, id)
  if (server === undefined) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay MCP server')
  }
  return server
}

/**
 * Xoa MCP server + disconnect + go tool khoi registry.
 *
 * @param db - Database client.
 * @param id - Id server.
 * @param manager - Manager MCP.
 */
export async function deleteMcpServer(
  db: Database,
  id: string,
  manager: McpManager,
): Promise<void> {
  const rows = await db
    .delete(mcpServers)
    .where(eq(mcpServers.id, id))
    .returning()

  if (rows.length === 0) {
    throw new AppError(ERROR_CODES.NOT_FOUND, 'Khong tim thay MCP server')
  }

  await manager.refresh([...(await listMcpServerConfigs(db))], { force: true })
}

/**
 * Ket noi lai 1 MCP server.
 *
 * @param db - Database client.
 * @param id - Id server.
 * @param manager - Manager MCP.
 * @returns Server sau khi ket noi lai.
 */
export async function reconnectMcpServer(
  db: Database,
  id: string,
  manager: McpManager,
): Promise<McpServer | undefined> {
  const current = await getMcpServer(db, id)
  if (current === undefined) return undefined

  const managed = await manager.reconnect(id)
  if (managed !== undefined) {
    await persistRuntimeState(db, managed)
  }

  const server = await getMcpServer(db, id)
  if (server === undefined) return undefined

  return {
    ...server,
    status: managed?.status ?? server.status,
    toolCount: managed?.tools.length ?? 0,
    ...(managed?.lastError !== undefined ? { lastError: managed.lastError } : {}),
  }
}

/**
 * Ghi trang thai runtime cua 1 server vao DB.
 *
 * @param db - Database client.
 * @param server - Server dang chay.
 */
async function persistRuntimeState(
  db: Database,
  server: ManagedMcpServer,
): Promise<void> {
  await db
    .update(mcpServers)
    .set({
      lastConnectedAt:
        server.lastConnectedAt !== undefined ? new Date(server.lastConnectedAt) : null,
      lastError: server.lastError ?? null,
      updatedAt: new Date(),
    })
    .where(eq(mcpServers.id, server.id))
}

/**
 * Dong bo trang thai runtime cua moi server vao DB.
 *
 * @param db - Database client.
 * @param manager - Manager MCP.
 */
async function syncRuntimeState(db: Database, manager: McpManager): Promise<void> {
  for (const server of manager.listServers()) {
    await persistRuntimeState(db, server)
  }
}

/**
 * Gom server tu DB + trang thai runtime thanh contract client.
 *
 * @param db - Database client.
 * @param manager - Manager MCP.
 * @returns Danh sach server voi trang thai.
 */
export async function listMcpServersWithState(
  db: Database,
  manager: McpManager,
): Promise<McpServer[]> {
  const rows = await listMcpServerRows(db)
  const managed = new Map(manager.listServers().map((server) => [server.id, server]))

  return rows.map((row) => {
    const runtime = managed.get(row.id)
    if (runtime === undefined) return row
    return {
      ...row,
      status: runtime.status,
      toolCount: runtime.tools.length,
      ...(runtime.lastError !== undefined ? { lastError: runtime.lastError } : {}),
    }
  })
}
