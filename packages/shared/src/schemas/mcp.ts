/**
 * Zod schema + contract cho **MCP server** (FR-TOOLS-01 — T-M2-08).
 *
 * MCP (Model Context Protocol) la chuan mo cua Anthropic de 1 MCP server
 * (tieng trinh rieng) expose **tool** cho client. Sidekick dung MCP client
 * de lay tool cua ben ngoai vao `ToolRegistry` (T-M2-07) → model goi duoc
 * tool do qua agent loop da co.
 *
 * Contract nay nam o `packages/shared` de server (validate o bien), extension
 * (Settings UI) va eval harness dung **cung 1 nguon su that**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27
 */

import { z } from 'zod'
import { MCP_SERVER_STATUSES } from '../constants.js'

/**
 * Transport cua MCP server.
 *
 * Lot T-M2-08 chi ho tro **stdio** (spawn child process, JSON-RPC qua
 * stdin/stdout). HTTP/SSE transport de task sau.
 */
export const mcpTransportSchema = z.literal('stdio')
export type McpTransport = z.infer<typeof mcpTransportSchema>

/** Trang thai ket noi cua 1 MCP server. */
export const mcpServerStatusSchema = z.enum(MCP_SERVER_STATUSES)
export type McpServerStatus = z.infer<typeof mcpServerStatusSchema>

/**
 * Ten MCP server.
 *
 * Chi chu cai thuong, dau gach, gach duoi → dung nguyên truc de lenh
 * `mcp__<server>__<tool>` hop le theo chuan ten function cua OpenAI.
 */
export const mcpServerNameSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9_-]+$/, 'Ten MCP server chi gom chu thuong, so, dau gach, gach duoi')

/** Du lieu tao MCP server moi. */
export const createMcpServerSchema = z.object({
  /** Ten server (unique) — dung de namespace tool. */
  name: mcpServerNameSchema,
  /** Transport — lot nay chi `stdio`. */
  transport: mcpTransportSchema.default('stdio'),
  /** Lenh spawn (vd `npx` · `node` · `uvx`). */
  command: z.string().min(1).max(500),
  /** Tham so truyen cho lenh. */
  args: z.array(z.string().max(500)).max(50).default([]),
  /** Bien moi truong them cho process (vd `API_KEY`). */
  env: z.record(z.string(), z.string()).default({}),
  /** Bat/tat server — tat → khong connect, tool cua server bi an khoi registry. */
  enabled: z.boolean().default(true),
  /**
   * Cho phep chay tool cua server nay **khong** can user duyet.
   *
   * Mac dinh `false` → tool MCP **luon** yeu cau duyet (FR-TOOLS-04).
   * Tool MCP la ma ben ngoai → mac dinh an toan la chan.
   */
  autoApprove: z.boolean().default(false),
})
export type CreateMcpServerInput = z.infer<typeof createMcpServerSchema>

/** Patch MCP server (chi cho phep doi cac field da biet). */
export const updateMcpServerSchema = createMcpServerSchema.partial().omit({ name: true })
export type UpdateMcpServerInput = z.infer<typeof updateMcpServerSchema>

/** 1 MCP server da luu (kèm trạng thái runtime). */
export const mcpServerSchema = createMcpServerSchema.extend({
  /** Id server (uuid). */
  id: z.string().min(1),
  /** Trang thai ket noi hien tai. */
  status: mcpServerStatusSchema,
  /** So tool server nay dang expose. */
  toolCount: z.number().int().nonnegative(),
  /** Loi ket noi gan nhat (tieng Viet) — `undefined` neu khong loi. */
  lastError: z.string().optional(),
  /** Moc ket noi gan nhat (ISO 8601). */
  lastConnectedAt: z.string().optional(),
})
export type McpServer = z.infer<typeof mcpServerSchema>

/** Response `GET /api/mcp/servers`. */
export const mcpServerListResponseSchema = z.object({
  items: z.array(mcpServerSchema),
})
export type McpServerListResponse = z.infer<typeof mcpServerListResponseSchema>

/**
 * 1 tool do MCP server expose.
 *
 * `name` da duoc namespace (`mcp__<server>__<tool>`) → dung ngay cho
 * `ToolRegistry` va provider.
 */
export const mcpToolSchema = z.object({
  /** Ten duoc namespace. */
  name: z.string().min(1),
  /** Ten goc cua tool tren MCP server. */
  originalName: z.string().min(1),
  /** Mo ta cho model. */
  description: z.string(),
  /** Id cua MCP server chua tool nay. */
  serverId: z.string().min(1),
  /** Ten cua MCP server chua tool nay. */
  serverName: z.string().min(1),
  /** Tool co can user duyet khong (FR-TOOLS-04). */
  requiresApproval: z.boolean(),
})
export type McpTool = z.infer<typeof mcpToolSchema>

/** Response `GET /api/mcp/tools`. */
export const mcpToolListResponseSchema = z.object({
  items: z.array(mcpToolSchema),
})
export type McpToolListResponse = z.infer<typeof mcpToolListResponseSchema>

/**
 * Response cua `POST /api/mcp/servers/:id/reconnect`.
 */
export const mcpReconnectResponseSchema = z.object({
  /** Server vua ket noi lai. */
  id: z.string().min(1),
  /** Trang thai moi. */
  status: mcpServerStatusSchema,
  /** So tool server dang expose. */
  toolCount: z.number().int().nonnegative(),
  /** Loi (tieng Viet) neu ket noi thatt bai. */
  error: z.string().optional(),
})
export type McpReconnectResponse = z.infer<typeof mcpReconnectResponseSchema>
