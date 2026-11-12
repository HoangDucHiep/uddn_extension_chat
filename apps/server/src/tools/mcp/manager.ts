/**
 * Quan ly vong doi nhieu **MCP server** (FR-TOOLS-01 — T-M2-08).
 *
 * Manager la **cau noi** giua:
 * - Bang `mcp_servers` (Postgres) → cau hinh nguoi dung.
 * - `McpClient` (stdio) → ket noi thuc te voi tien trinh MCP server.
 * - `ToolRegistry` (T-M2-07) → tool MCP duoc model goi qua agent loop.
 *
 * Nguyen tac:
 * - **1 server loi khong chan server khac** → server do chuyen `error` +
 *   `lastError`, tool cua server con lai van dung.
 * - **Khong spawn lai moi luot chat** → server da connect + cau hinh khong
 *   doi → bo qua (chi doc lai DB).
 * - **Tool MCP mac dinh can duyet** (FR-TOOLS-04) → `autoApprove` tren server.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.3
 */

import { MCP_LIMITS, type ToolResult } from '@sidekick/shared'
import { McpClient, McpClientError, type McpToolInfo } from './client.js'
import type { ToolRegistry } from '../registry.js'
import type { Tool } from '../types.js'

/** Tien to namespace cua tool MCP. */
export const MCP_TOOL_PREFIX = 'mcp__'

/** 1 MCP server da duoc manager theo doi. */
export interface ManagedMcpServer {
  /** Id server (uuid). */
  id: string
  /** Ten server (dung de namespace). */
  name: string
  /** Lenh spawn. */
  command: string
  /** Tham so. */
  args: readonly string[]
  /** Bien moi truong. */
  env: Readonly<Record<string, string>>
  /** Bat/tat — tat → khong connect. */
  enabled: boolean
  /** Cho phep chay tool khong can duyet. */
  autoApprove: boolean
  /** Trang thai ket noi. */
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  /** Loi gan nhat (tieng Viet). */
  lastError: string | undefined
  /** Moc ket noi gan nhat (ISO 8601). */
  lastConnectedAt: string | undefined
  /** Client dang chay (undefined neu chua connect). */
  client: McpClient | undefined
  /** Tool server dang expose (ten da namespace). */
  tools: McpToolInfo[]
}

/** 1 tool MCP da duoc namespace + dang ky vao registry. */
export interface RegisteredMcpTool {
  /** Ten duoc namespace. */
  name: string
  /** Ten goc tren MCP server. */
  originalName: string
  /** Id server. */
  serverId: string
  /** Ten server. */
  serverName: string
  /** Mo ta. */
  description: string
  /** Tool co can duyet khong. */
  requiresApproval: boolean
}

/**
 * Tao ten namespace cho tool MCP.
 *
 * Dinh dang: `mcp__<server>__<tool>` → hop le theo chuan ten function cua
 * OpenAI (`[a-zA-Z0-9_-]{1,64}`) → provider chap nhan nguyen trang.
 *
 * @param serverName - Ten MCP server.
 * @param toolName - Ten tool goc.
 * @returns Ten da namespace.
 */
export function namespacedToolName(serverName: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${serverName}__${toolName}`
}

/**
 * Tach ten namespace nguoc lai (server + tool goc).
 *
 * @param namespacedName - Ten da namespace.
 * @returns Cap `{ serverName, toolName }` hoac `null` neu khong phai tool MCP.
 */
export function parseNamespacedToolName(
  namespacedName: string,
): { serverName: string; toolName: string } | null {
  if (!namespacedName.startsWith(MCP_TOOL_PREFIX)) return null

  const rest = namespacedName.slice(MCP_TOOL_PREFIX.length)
  const separatorIndex = rest.indexOf('__')
  if (separatorIndex <= 0) return null

  return {
    serverName: rest.slice(0, separatorIndex),
    toolName: rest.slice(separatorIndex + 2),
  }
}

/**
 * Manager cua cac MCP server.
 */
export class McpManager {
  private readonly servers = new Map<string, ManagedMcpServer>()
  private readonly registry: ToolRegistry
  private refreshPromise: Promise<void> | undefined

  /**
   * @param registry - Registry tool (MCP tool duoc dang ky vao day).
   */
  constructor(registry: ToolRegistry) {
    this.registry = registry
  }

  /**
   * Danh sach server dang theo doi.
   *
   * @returns Mang server (copy).
   */
  listServers(): ManagedMcpServer[] {
    return [...this.servers.values()]
  }

  /**
   * Danh sach tool MCP dang expose (ten da namespace).
   *
   * @returns Mang tool.
   */
  listTools(): RegisteredMcpTool[] {
    const items: RegisteredMcpTool[] = []
    for (const server of this.servers.values()) {
      for (const tool of server.tools) {
        items.push({
          name: namespacedToolName(server.name, tool.name),
          originalName: tool.name,
          serverId: server.id,
          serverName: server.name,
          description: tool.description,
          requiresApproval: !server.autoApprove,
        })
      }
    }
    return items
  }

  /**
   * Lam moi trang thai tu DB: doc cau hinh → connect → dong bo tool.
   *
   * **Cache TTL** → khong spawn lai process o moi luot chat.
   *
   * @param servers - Cau hinh tu DB.
   * @param options - Tuy chon.
   * @param options.force - Bo qua cache TTL (dung khi user bam "Ket noi lai").
   * @returns Danh sach server sau khi lam moi.
   */
  async refresh(
    servers: readonly McpServerConfig[],
    options: { force?: boolean | undefined } = {},
  ): Promise<ManagedMcpServer[]> {
    // Chong chay 2 refresh song song (agent loop + API co the den cung luc).
    if (this.refreshPromise !== undefined) {
      await this.refreshPromise
      return this.listServers()
    }

    this.refreshPromise = this.doRefresh(servers, options.force === true)
    try {
      await this.refreshPromise
    } finally {
      this.refreshPromise = undefined
    }
    return this.listServers()
  }

  /**
   * Thuc hien refresh that (spawn / disconnect theo cau hinh).
   *
   * @param servers - Cau hinh tu DB.
   * @param force - Ket noi lai ke ca khi cau hinh khong doi.
   */
  private async doRefresh(
    servers: readonly McpServerConfig[],
    force: boolean,
  ): Promise<void> {
    const wanted = new Map(servers.map((server) => [server.id, server]))

    // Server bi xoa khoi DB → disconnect + go tool.
    for (const [id, server] of [...this.servers]) {
      if (!wanted.has(id)) {
        await this.shutdownServer(server)
        this.servers.delete(id)
      }
    }

    for (const config of servers) {
      const existing = this.servers.get(config.id)

      if (!config.enabled) {
        if (existing !== undefined) await this.shutdownServer(existing)
        this.servers.set(config.id, {
          id: config.id,
          name: config.name,
          command: config.command,
          args: [...config.args],
          env: { ...config.env },
          enabled: false,
          autoApprove: config.autoApprove,
          status: 'disconnected',
          lastError: undefined,
          lastConnectedAt: existing?.lastConnectedAt,
          client: undefined,
          tools: [],
        })
        continue
      }

      // Cau hinh thay doi → disconnect roi connect lai.
      const changed =
        existing === undefined ||
        existing.command !== config.command ||
        JSON.stringify(existing.args) !== JSON.stringify(config.args) ||
        JSON.stringify(existing.env) !== JSON.stringify(config.env) ||
        existing.autoApprove !== config.autoApprove

      if (changed && existing !== undefined) {
        await this.shutdownServer(existing)
        this.servers.delete(config.id)
      }

      if (this.servers.has(config.id) && !force) continue

      if (this.servers.has(config.id)) {
        // `force` → ket noi lai server dang chay.
        const current = this.servers.get(config.id)
        if (current !== undefined) {
          await this.shutdownServer(current)
          this.servers.delete(config.id)
        }
      }

      const server: ManagedMcpServer = {
        id: config.id,
        name: config.name,
        command: config.command,
        args: [...config.args],
        env: { ...config.env },
        enabled: true,
        autoApprove: config.autoApprove,
        status: 'connecting',
        lastError: undefined,
        lastConnectedAt: undefined,
        client: undefined,
        tools: [],
      }
      this.servers.set(config.id, server)

      await this.connectServer(server)
    }
  }

  /**
   * Connect 1 server + dong bo tool vao registry.
   *
   * @param server - Server can connect.
   */
  private async connectServer(server: ManagedMcpServer): Promise<void> {
    const client = new McpClient({
      command: server.command,
      args: server.args,
      env: server.env,
    })

    try {
      await client.connect()
      const tools = await client.listTools()

      server.client = client
      server.tools = tools
      server.status = 'connected'
      server.lastError = undefined
      server.lastConnectedAt = new Date().toISOString()

      this.registerTools(server, tools)
    } catch (error: unknown) {
      server.status = 'error'
      server.lastError =
        error instanceof McpClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Không kết nối được MCP server'
      server.tools = []
      await client.disconnect().catch(() => undefined)
      server.client = undefined
    }
  }

  /**
   * Dang ky tool cua 1 MCP server vao `ToolRegistry`.
   *
   * @param server - Server nguon.
   * @param tools - Tool cua server.
   */
  private registerTools(server: ManagedMcpServer, tools: readonly McpToolInfo[]): void {
    // Xoa tool cua server nay truoc → tranh tool stale khi MCP server doi danh sach.
    this.registry.unregisterByPrefix(`${MCP_TOOL_PREFIX}${server.name}__`)

    for (const tool of tools) {
      const namespaced = namespacedToolName(server.name, tool.name)
      const requiresApproval = !server.autoApprove

      const registered: Tool = {
        name: namespaced,
        description:
          tool.description.length > 0
            ? tool.description
            : `Tool "${tool.name}" tu MCP server "${server.name}"`,
        parameters: tool.parameters,
        requiresApproval,
        ...(requiresApproval
          ? {
              approvalReason: `Tool "${namespaced}" từ MCP server "${server.name}" cần bạn duyệt trước khi chạy.`,
            }
          : {}),
        execute: async (args: unknown): Promise<ToolResult> =>
          this.executeServerTool(server, tool.name, args),
      }

      this.registry.register(registered)
    }
  }

  /**
   * Chay 1 tool cua MCP server.
   *
   * Loi **khong** nem ra ngoài → tra `ok: false` (agent loop xu ly).
   *
   * @param server - Server chua tool.
   * @param toolName - Ten tool goc.
   * @param args - Tham so.
   * @returns Ket qua tool.
   */
  private async executeServerTool(
    server: ManagedMcpServer,
    toolName: string,
    args: unknown,
  ): Promise<ToolResult> {
    const client = server.client
    if (client === undefined || !client.isConnected) {
      return {
        ok: false,
        output: `MCP server "${server.name}" không kết nối.`,
        error: 'MCP_DISCONNECTED',
      }
    }

    try {
      const result = await client.callTool(toolName, args)
      const output = result.output.slice(0, MCP_LIMITS.MAX_OUTPUT_CHARS)
      return result.ok
        ? { ok: true, output }
        : { ok: false, output, error: 'MCP_TOOL_ERROR' }
    } catch (error: unknown) {
      return {
        ok: false,
        output:
          error instanceof McpClientError
            ? error.message
            : 'MCP server trả lời lỗi khi gọi tool.',
        error: 'MCP_CALL_FAILED',
      }
    }
  }

  /**
   * Ket noi lai 1 server theo id.
   *
   * @param id - Id server.
   * @returns Server sau khi ket noi lai.
   */
  async reconnect(id: string): Promise<ManagedMcpServer | undefined> {
    const server = this.servers.get(id)
    if (server === undefined) return undefined

    await this.shutdownServer(server)
    server.client = undefined
    server.tools = []
    server.status = 'connecting'
    server.lastError = undefined

    this.registry.unregisterByPrefix(`${MCP_TOOL_PREFIX}${server.name}__`)

    await this.connectServer(server)
    return server
  }

  /**
   * Disconnect 1 server + go tool khoi registry.
   *
   * @param server - Server can dong.
   */
  private async shutdownServer(server: ManagedMcpServer): Promise<void> {
    if (server.client !== undefined) {
      await server.client.disconnect().catch(() => undefined)
    }
    server.client = undefined
    server.tools = []
    server.status = 'disconnected'
    this.registry.unregisterByPrefix(`${MCP_TOOL_PREFIX}${server.name}__`)
  }

  /** Disconnect moi server + go tool (dung khi BFF tat). */
  async disconnectAll(): Promise<void> {
    for (const server of [...this.servers.values()]) {
      await this.shutdownServer(server)
    }
    this.servers.clear()
  }
}

/**
 * Cau hinh 1 MCP server (tu DB, da rut gon).
 */
export interface McpServerConfig {
  /** Id server. */
  id: string
  /** Ten server. */
  name: string
  /** Lenh spawn. */
  command: string
  /** Tham so. */
  args: readonly string[]
  /** Bien moi truong. */
  env: Readonly<Record<string, string>>
  /** Bat/tat. */
  enabled: boolean
  /** Cho phep chay tool khong can duyet. */
  autoApprove: boolean
}
