/**
 * Client goi BFF cho **MCP server** (FR-TOOLS-01 — T-M2-08).
 *
 * Dung `fetchJson` cua `lib/apiClient.ts` → loi chuan hoa san (`ApiError`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27
 */

import {
  API_ROUTES,
  type CreateMcpServerInput,
  type McpReconnectResponse,
  type McpServer,
  type McpServerListResponse,
  type McpToolListResponse,
  type UpdateMcpServerInput,
} from '@sidekick/shared'
import { fetchJson } from './apiClient.js'

/**
 * Liet ke MCP server + trang thai ket noi.
 */
export async function listMcpServers(): Promise<McpServerListResponse> {
  return fetchJson<McpServerListResponse>(API_ROUTES.mcpServers)
}

/**
 * Liet ke tool MCP dang expose cho model.
 */
export async function listMcpTools(): Promise<McpToolListResponse> {
  return fetchJson<McpToolListResponse>(API_ROUTES.mcpTools)
}

/**
 * Them MCP server moi (server connect thu ngay).
 *
 * @param input - Cau hinh server.
 */
export async function createMcpServer(input: CreateMcpServerInput): Promise<McpServer> {
  return fetchJson<McpServer>(API_ROUTES.mcpServers, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Sua cau hinh MCP server.
 *
 * @param id - Id server.
 * @param input - Truong can doi.
 */
export async function updateMcpServer(
  id: string,
  input: UpdateMcpServerInput,
): Promise<McpServer> {
  return fetchJson<McpServer>(`${API_ROUTES.mcpServers}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Xoa MCP server (server disconnect + go tool).
 *
 * @param id - Id server.
 */
export async function deleteMcpServer(id: string): Promise<void> {
  await fetchJson<void>(`${API_ROUTES.mcpServers}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/**
 * Ket noi lai 1 MCP server.
 *
 * @param id - Id server.
 * @returns Ket qua ket noi lai (trang thai · so tool · loi neu co).
 */
export async function reconnectMcpServer(id: string): Promise<McpReconnectResponse> {
  return fetchJson<McpReconnectResponse>(
    `${API_ROUTES.mcpServers}/${encodeURIComponent(id)}/reconnect`,
    { method: 'POST' },
  )
}
