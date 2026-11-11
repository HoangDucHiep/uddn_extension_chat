import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createToolsRouter } from '../src/routes/tools.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import { ToolRegistry } from '../src/tools/registry.js'
import type { Tool } from '../src/tools/types.js'
import { createFakeConversationDb } from './helpers/fakeConversationDb.js'

/**
 * Unit test cho route tools (T-M2-07/09 — FR-TOOLS-01/04).
 *
 * AC goc:
 * - "`GET /api/tools` → danh sach tool dang co".
 * - "`POST /api/tools/:callId/approve` → set `approved_by_user`".
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.26
 */

let server: Server
let baseUrl: string
const fake = createFakeConversationDb()

/** Tool can duyet (de test co `requiresApproval: true`). */
const dangerousTool: Tool = {
  name: 'danger',
  description: 'Tool nguy hiem',
  parameters: { type: 'object', properties: {} },
  requiresApproval: true,
  approvalReason: 'Can duyet',
  async execute() {
    return { ok: true, output: 'ok' }
  },
}

beforeAll(async () => {
  const toolRegistry = new ToolRegistry()
  toolRegistry.register(dangerousTool)

  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createToolsRouter({ db: fake.db as never, toolRegistry }))
  app.use(notFoundHandler)
  app.use(errorHandler)

  server = await new Promise<Server>((resolve) => {
    const created = app.listen(0, () => resolve(created))
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('GET /api/tools', () => {
  it('tra danh sach tool (200)', async () => {
    const response = await fetch(`${baseUrl}/api/tools`)
    const body = (await response.json()) as {
      items: Array<{ name: string; description: string; requiresApproval: boolean }>
    }

    expect(response.status).toBe(200)
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items[0]?.name).toBe('danger')
  })

  it('muc do can duyet duoc phan hien', async () => {
    const response = await fetch(`${baseUrl}/api/tools`)
    const body = (await response.json()) as {
      items: Array<{ name: string; requiresApproval: boolean }>
    }

    expect(body.items.find((item) => item.name === 'danger')?.requiresApproval).toBe(true)
  })
})

describe('POST /api/tools/:callId/approve', () => {
  it('duyet tool call → approvedByUser = true', async () => {
    const seeded = fake.seedToolCall({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'danger',
      approvalRequired: true,
      approvedByUser: false,
    })

    const response = await fetch(
      `${baseUrl}/api/tools/${seeded.id}/approve`,
      { method: 'POST' },
    )
    const body = (await response.json()) as { id: string; approvedByUser: boolean }

    expect(response.status).toBe(200)
    expect(body.id).toBe(seeded.id)
    expect(body.approvedByUser).toBe(true)
  })

  it('tool call khong ton tai → 404 NOT_FOUND', async () => {
    const response = await fetch(
      `${baseUrl}/api/tools/22222222-2222-4222-8222-222222222222/approve`,
      { method: 'POST' },
    )
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('POST /api/tools/:callId/deny', () => {
  it('tu choi tool call → approvedByUser = false', async () => {
    const seeded = fake.seedToolCall({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'danger',
      approvalRequired: true,
      approvedByUser: true,
    })

    const response = await fetch(`${baseUrl}/api/tools/${seeded.id}/deny`, { method: 'POST' })
    const body = (await response.json()) as { id: string; approvedByUser: boolean }

    expect(response.status).toBe(200)
    expect(body.id).toBe(seeded.id)
    expect(body.approvedByUser).toBe(false)
  })

  it('tool call khong ton tai → 404', async () => {
    const response = await fetch(
      `${baseUrl}/api/tools/44444444-4444-4444-8444-444444444444/deny`,
      { method: 'POST' },
    )
    expect(response.status).toBe(404)
  })
})
