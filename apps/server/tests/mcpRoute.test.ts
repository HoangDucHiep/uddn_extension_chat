import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createMcpRouter } from '../src/routes/mcp.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import { ToolRegistry } from '../src/tools/registry.js'
import { McpManager } from '../src/tools/mcp/manager.js'
import { createFakeMcpDb } from './helpers/fakeMcpDb.js'

/**
 * Unit test cho route MCP (FR-TOOLS-01 — T-M2-08).
 *
 * AC goc:
 * - "MCP client (stdio transport) + server manager".
 * - "`GET/POST/PATCH/DELETE /api/mcp/servers`".
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.27
 */

let server: Server
let baseUrl: string
const fake = createFakeMcpDb()
const toolRegistry = new ToolRegistry()
const mcpManager = new McpManager(toolRegistry)

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createMcpRouter({ db: fake.db as never, mcpManager }))
  app.use(notFoundHandler)
  app.use(errorHandler)

  server = await new Promise<Server>((resolve) => {
    const created = app.listen(0, () => resolve(created))
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await mcpManager.disconnectAll()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

afterEach(() => {
  fake.mcpServerRows.length = 0
})

describe('GET /api/mcp/servers', () => {
  it('tra danh sach server rong khi chua co', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/servers`)
    const body = (await response.json()) as { items: unknown[] }

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(0)
  })

  it('tra danh sach server da luu', async () => {
    fake.seedMcpServer({ name: 'alpha', command: 'node' })

    const response = await fetch(`${baseUrl}/api/mcp/servers`)
    const body = (await response.json()) as { items: Array<{ name: string }> }

    expect(response.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]?.name).toBe('alpha')
  })
})

describe('POST /api/mcp/servers', () => {
  it('them MCP server moi → 201', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'sample',
        command: process.execPath,
        args: ['/tmp/sample-mcp-server.mjs'],
      }),
    })
    const body = (await response.json()) as { id: string; name: string }

    expect(response.status).toBe(201)
    expect(body.name).toBe('sample')
    expect(body.id.length).toBeGreaterThan(0)
  })

  it('ten trung → 409 CONFLICT', async () => {
    fake.seedMcpServer({ name: 'dup', command: 'node' })

    const response = await fetch(`${baseUrl}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'dup', command: 'node' }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
  })

  it('body khong hop le → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/servers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bad Name!', command: '' }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('PATCH /api/mcp/servers/:id', () => {
  it('sua cau hinh → 200', async () => {
    const seeded = fake.seedMcpServer({ name: 'alpha', command: 'node' })

    const response = await fetch(`${baseUrl}/api/mcp/servers/${seeded.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ autoApprove: true }),
    })
    const body = (await response.json()) as { id: string; autoApprove: boolean }

    expect(response.status).toBe(200)
    expect(body.id).toBe(seeded.id)
    expect(body.autoApprove).toBe(true)
  })

  it('server khong ton tai → 404 NOT_FOUND', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/servers/22222222-2222-4222-8222-222222222222`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ autoApprove: true }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('DELETE /api/mcp/servers/:id', () => {
  it('xoa MCP server → 204', async () => {
    const seeded = fake.seedMcpServer({ name: 'alpha', command: 'node' })

    const response = await fetch(`${baseUrl}/api/mcp/servers/${seeded.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
    expect(fake.mcpServerRows).toHaveLength(0)
  })

  it('server khong ton tai → 404', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/servers/33333333-3333-4333-8333-333333333333`, {
      method: 'DELETE',
    })
    expect(response.status).toBe(404)
  })
})

describe('POST /api/mcp/servers/:id/reconnect', () => {
  it('server khong ton tai → 404', async () => {
    const response = await fetch(
      `${baseUrl}/api/mcp/servers/44444444-4444-4444-8444-444444444444/reconnect`,
      { method: 'POST' },
    )
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /api/mcp/tools', () => {
  it('tra danh sach tool MCP (rong neu chua connect)', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/tools`)
    const body = (await response.json()) as { items: unknown[] }

    expect(response.status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
  })
})
