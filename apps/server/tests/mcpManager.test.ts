import { afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { ToolRegistry } from '../src/tools/registry.js'
import {
  McpManager,
  namespacedToolName,
  parseNamespacedToolName,
  type McpServerConfig,
} from '../src/tools/mcp/manager.js'

/**
 * Unit test cho McpManager (FR-TOOLS-01 — T-M2-08).
 *
 * AC goc:
 * - "MCP client (stdio transport) + server manager".
 * - "`mcp__<server>__<tool>` namespace tool MCP".
 * - "Tool MCP mac dinh can duyet (approval gate)".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.3
 */

const here = dirname(fileURLToPath(import.meta.url))
const SAMPLE_SERVER = resolve(here, '../scripts/sample-mcp-server.mjs')

/** Manager dang chay → dong lai sau moi test. */
const openManagers: McpManager[] = []

/**
 * Tao cau hinh MCP server tro toi server mau.
 *
 * @param overrides - Gia tri ghi de.
 * @returns Cau hinh.
 */
function sampleConfig(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: 'server-1',
    name: 'sample',
    command: process.execPath,
    args: [SAMPLE_SERVER],
    env: {},
    enabled: true,
    autoApprove: false,
    ...overrides,
  }
}

/**
 * Tao manager + registry.
 *
 * @returns Cap `{ manager, registry }`.
 */
function createManager(): { manager: McpManager; registry: ToolRegistry } {
  const registry = new ToolRegistry()
  const manager = new McpManager(registry)
  openManagers.push(manager)
  return { manager, registry }
}

afterEach(async () => {
  while (openManagers.length > 0) {
    const manager = openManagers.pop()
    if (manager !== undefined) await manager.disconnectAll()
  }
})

describe('mcp manager — namespace tool', () => {
  it('ten tool co namespace mcp__<server>__<tool>', () => {
    expect(namespacedToolName('sample', 'echo')).toBe('mcp__sample__echo')
  })

  it('tach nguoc lai ten namespace', () => {
    expect(parseNamespacedToolName('mcp__sample__echo')).toEqual({
      serverName: 'sample',
      toolName: 'echo',
    })
  })

  it('ten khong phai tool MCP → null', () => {
    expect(parseNamespacedToolName('calculator')).toBeNull()
  })
})

describe('mcp manager — refresh', () => {
  it('connect MCP server → status connected + tool da namespace', async () => {
    const { manager } = createManager()

    const servers = await manager.refresh([sampleConfig()])
    expect(servers).toHaveLength(1)
    expect(servers[0]?.status).toBe('connected')
    expect(servers[0]?.tools.map((tool) => tool.name)).toEqual(['echo', 'add'])
  })

  it('tool MCP duoc dang ky vao ToolRegistry', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig()])
    expect(registry.get('mcp__sample__echo')).toBeDefined()
    expect(registry.get('mcp__sample__add')).toBeDefined()
  })

  it('tool MCP mac dinh can duyet (autoApprove = false)', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig({ autoApprove: false })])
    expect(registry.requiresApproval('mcp__sample__echo')).toBe(true)
  })

  it('autoApprove = true → tool khong can duyet', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig({ autoApprove: true })])
    expect(registry.requiresApproval('mcp__sample__echo')).toBe(false)
  })

  it('server disabled → khong connect, khong co tool', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig({ enabled: false })])
    expect(manager.listServers()[0]?.status).toBe('disconnected')
    expect(registry.get('mcp__sample__echo')).toBeUndefined()
  })

  it('server loi khong chan server khac', async () => {
    const { manager } = createManager()

    await manager.refresh([
      sampleConfig({ id: 'bad', name: 'bad', command: 'sidekick-no-such-command' }),
      sampleConfig({ id: 'good', name: 'good' }),
    ])

    const bad = manager.listServers().find((server) => server.id === 'bad')
    const good = manager.listServers().find((server) => server.id === 'good')
    expect(bad?.status).toBe('error')
    expect(bad?.lastError).toBeTruthy()
    expect(good?.status).toBe('connected')
  })

  it('refresh trong TTL → khong spawn lai process', async () => {
    const { manager } = createManager()

    await manager.refresh([sampleConfig()])
    const firstConnectedAt = manager.listServers()[0]?.lastConnectedAt

    await manager.refresh([sampleConfig()])
    expect(manager.listServers()[0]?.lastConnectedAt).toBe(firstConnectedAt)
  })

  it('refresh voi force = true → ket noi lai', async () => {
    const { manager } = createManager()

    await manager.refresh([sampleConfig()])
    const first = manager.listServers()[0]?.client

    await manager.refresh([sampleConfig()], { force: true })
    expect(manager.listServers()[0]?.client).not.toBe(first)
    expect(manager.listServers()[0]?.status).toBe('connected')
  })

  it('server bi xoa khoi DB → tool bi go khoi registry', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig()])
    expect(registry.get('mcp__sample__echo')).toBeDefined()

    await manager.refresh([])
    expect(registry.get('mcp__sample__echo')).toBeUndefined()
  })
})

describe('mcp manager — listTools', () => {
  it('tra ve tool da namespace + can duyet', async () => {
    const { manager } = createManager()

    await manager.refresh([sampleConfig()])
    const tools = manager.listTools()

    expect(tools.map((tool) => tool.name)).toEqual([
      'mcp__sample__echo',
      'mcp__sample__add',
    ])
    expect(tools[0]?.originalName).toBe('echo')
    expect(tools[0]?.requiresApproval).toBe(true)
  })
})

describe('mcp manager — execute tool', () => {
  it('chay tool qua MCP server → ok: true', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig()])
    const tool = registry.get('mcp__sample__echo')
    expect(tool).toBeDefined()
    if (tool === undefined) return

    const result = await tool.execute({ text: 'hi' }, { requestId: 'req-1' })
    expect(result.ok).toBe(true)
    expect(result.output).toContain('hi')
  })

  it('tool MCP loi → ok: false (khong nem loi ra ngoai)', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig()])
    const tool = registry.get('mcp__sample__add')
    expect(tool).toBeDefined()
    if (tool === undefined) return

    const result = await tool.execute({ a: 1 }, { requestId: 'req-1' })
    expect(result.ok).toBe(false)
    expect(result.output.length).toBeGreaterThan(0)
  })
})

describe('mcp manager — reconnect', () => {
  it('reconnect 1 server → ket noi lai thanh cong', async () => {
    const { manager } = createManager()

    await manager.refresh([sampleConfig()])
    const server = await manager.reconnect('server-1')

    expect(server?.status).toBe('connected')
    expect(server?.tools.length).toBe(2)
  })

  it('reconnect server khong ton tai → undefined', async () => {
    const { manager } = createManager()
    expect(await manager.reconnect('nope')).toBeUndefined()
  })
})

describe('mcp manager — disconnectAll', () => {
  it('dong moi server + go tool', async () => {
    const { manager, registry } = createManager()

    await manager.refresh([sampleConfig()])
    await manager.disconnectAll()

    expect(manager.listServers()).toHaveLength(0)
    expect(registry.get('mcp__sample__echo')).toBeUndefined()
  })
})
