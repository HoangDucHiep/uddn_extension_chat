import { afterEach, describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { McpClient, McpClientError } from '../src/tools/mcp/client.js'

/**
 * Unit test cho MCP client stdio (FR-TOOLS-01 — T-M2-08).
 *
 * Dung `scripts/sample-mcp-server.mjs` lam MCP server that → test handshake
 * `initialize` + `tools/list` + `tools/call` that su.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.2
 */

const here = dirname(fileURLToPath(import.meta.url))
const SAMPLE_SERVER = resolve(here, '../scripts/sample-mcp-server.mjs')

/** Client dang mo → dong lai sau moi test. */
const openClients: McpClient[] = []

/**
 * Tao client tro toi MCP server mau.
 *
 * @returns Client da tao (chua connect).
 */
function createClient(): McpClient {
  const client = new McpClient({
    command: process.execPath,
    args: [SAMPLE_SERVER],
    env: {},
    requestTimeoutMs: 5_000,
  })
  openClients.push(client)
  return client
}

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop()
    if (client !== undefined) await client.disconnect()
  }
})

describe('McpClient — connect', () => {
  it('handshake thanh cong (initialize + notifications/initialized)', async () => {
    const client = createClient()
    await client.connect()

    expect(client.isConnected).toBe(true)
  })

  it('connect 2 lan → disconnect truoc, khong loi', async () => {
    const client = createClient()
    await client.connect()
    await expect(client.connect()).resolves.toBeUndefined()
    expect(client.isConnected).toBe(true)
  })

  it('lenh khong ton tai → McpClientError (spawn)', async () => {
    const client = new McpClient({
      command: 'sidekick-command-that-does-not-exist',
      args: [],
      env: {},
      requestTimeoutMs: 3_000,
    })
    openClients.push(client)

    await expect(client.connect()).rejects.toBeInstanceOf(McpClientError)
  })
})

describe('McpClient — listTools', () => {
  it('tra ve danh sach tool cua MCP server', async () => {
    const client = createClient()
    await client.connect()

    const tools = await client.listTools()
    expect(tools.map((tool) => tool.name)).toEqual(['echo', 'add'])
  })

  it('chuan hoa inputSchema thanh object', async () => {
    const client = createClient()
    await client.connect()

    const tools = await client.listTools()
    const echo = tools.find((tool) => tool.name === 'echo')
    expect(echo?.parameters.type).toBe('object')
    expect(echo?.parameters.required).toEqual(['text'])
  })

  it('lay mo ta tool', async () => {
    const client = createClient()
    await client.connect()

    const tools = await client.listTools()
    expect(tools.find((tool) => tool.name === 'add')?.description.length).toBeGreaterThan(0)
  })
})

describe('McpClient — callTool', () => {
  it('goi tool thanh cong → ok: true + output', async () => {
    const client = createClient()
    await client.connect()

    const result = await client.callTool('echo', { text: 'xin chao' })
    expect(result.ok).toBe(true)
    expect(result.output).toContain('xin chao')
  })

  it('goi tool sai → ok: false (khong nem loi)', async () => {
    const client = createClient()
    await client.connect()

    const result = await client.callTool('unknown-tool', {})
    expect(result.ok).toBe(false)
    expect(result.output.length).toBeGreaterThan(0)
  })

  it('tool bao loi → isError → ok: false', async () => {
    const client = createClient()
    await client.connect()

    const result = await client.callTool('add', { a: 'x', b: 1 })
    expect(result.ok).toBe(false)
  })
})

describe('McpClient — disconnect', () => {
  it('disconnect idempotent (goi nhieu lan khong loi)', async () => {
    const client = createClient()
    await client.connect()

    await expect(client.disconnect()).resolves.toBeUndefined()
    await expect(client.disconnect()).resolves.toBeUndefined()
    expect(client.isConnected).toBe(false)
  })

  it('goi tool sau khi disconnect → McpClientError', async () => {
    const client = createClient()
    await client.connect()
    await client.disconnect()

    await expect(client.callTool('echo', { text: 'x' })).rejects.toBeInstanceOf(
      McpClientError,
    )
  })
})
