import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMcpServer,
  deleteMcpServer,
  listMcpServers,
  listMcpTools,
  reconnectMcpServer,
  updateMcpServer,
} from '../src/lib/mcpClient.js'

/**
 * Unit test cho client MCP (FR-TOOLS-01 — T-M2-08).
 *
 * Kiem chung: dung URL + method cho list / create / update / delete /
 * reconnect / list tools.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27
 */

/** Mock fetch tra payload given. */
function stubFetch(payload: unknown, ok = true, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listMcpServers', () => {
  it('goi GET /api/mcp/servers va tra ve danh sach server', async () => {
    const fetchMock = stubFetch({
      items: [
        {
          id: 'srv-1',
          name: 'sample',
          transport: 'stdio',
          command: 'node',
          args: [],
          env: {},
          enabled: true,
          autoApprove: false,
          status: 'connected',
          toolCount: 2,
        },
      ],
    })

    const result = await listMcpServers()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.name).toBe('sample')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/mcp/servers')
    expect(call[1].method).toBeUndefined()
  })
})

describe('listMcpTools', () => {
  it('goi GET /api/mcp/tools', async () => {
    const fetchMock = stubFetch({
      items: [
        {
          name: 'mcp__sample__echo',
          originalName: 'echo',
          serverId: 'srv-1',
          serverName: 'sample',
          description: 'Echo',
          requiresApproval: true,
        },
      ],
    })

    const result = await listMcpTools()

    expect(result.items[0]?.name).toBe('mcp__sample__echo')
    const call = fetchMock.mock.calls[0] as unknown as [string]
    expect(call[0]).toContain('/api/mcp/tools')
  })
})

describe('createMcpServer', () => {
  it('goi POST /api/mcp/servers voi body dau day du', async () => {
    const fetchMock = stubFetch({
      id: 'srv-1',
      name: 'sample',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { KEY: 'value' },
      enabled: true,
      autoApprove: false,
      status: 'connected',
      toolCount: 1,
    })

    const result = await createMcpServer({
      name: 'sample',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server'],
      env: { KEY: 'value' },
      enabled: true,
      autoApprove: false,
    })

    expect(result.id).toBe('srv-1')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/mcp/servers')
    expect(call[1].method).toBe('POST')
    const body = JSON.parse(String(call[1].body)) as { name: string; args: string[] }
    expect(body.name).toBe('sample')
    expect(body.args).toEqual(['-y', 'server'])
  })
})

describe('updateMcpServer', () => {
  it('goi PATCH /api/mcp/servers/:id', async () => {
    const fetchMock = stubFetch({
      id: 'srv-1',
      name: 'sample',
      transport: 'stdio',
      command: 'npx',
      args: [],
      env: {},
      enabled: true,
      autoApprove: true,
      status: 'connected',
      toolCount: 1,
    })

    const result = await updateMcpServer('srv-1', { autoApprove: true })

    expect(result.autoApprove).toBe(true)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/mcp/servers/srv-1')
    expect(call[1].method).toBe('PATCH')
  })
})

describe('deleteMcpServer', () => {
  it('goi DELETE /api/mcp/servers/:id', async () => {
    const fetchMock = stubFetch('', true, 204)

    await deleteMcpServer('srv-1')

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/mcp/servers/srv-1')
    expect(call[1].method).toBe('DELETE')
  })

  it('id chua doi → encode trong URL', async () => {
    const fetchMock = stubFetch('', true, 204)

    await deleteMcpServer('a/b')

    const call = fetchMock.mock.calls[0] as unknown as [string]
    expect(call[0]).toContain('a%2Fb')
  })
})

describe('reconnectMcpServer', () => {
  it('goi POST /api/mcp/servers/:id/reconnect', async () => {
    const fetchMock = stubFetch({ id: 'srv-1', status: 'connected', toolCount: 3 })

    const result = await reconnectMcpServer('srv-1')

    expect(result.toolCount).toBe(3)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/mcp/servers/srv-1/reconnect')
    expect(call[1].method).toBe('POST')
  })

  it('BFF tra loi → throw', async () => {
    stubFetch({ error: { code: 'NOT_FOUND', message: 'Khong tim thay MCP server' } }, false, 404)

    await expect(reconnectMcpServer('khong-ton-tai')).rejects.toThrow(
      'Khong tim thay MCP server',
    )
  })
})
