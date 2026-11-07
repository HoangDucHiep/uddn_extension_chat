import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createConversationsRouter } from '../src/routes/conversations.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import {
  createFakeConversationDb,
  type FakeConversationDb,
} from './helpers/fakeConversationDb.js'

/**
 * Unit test cho route CRUD conversation (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Dung Express that + fake DB → kiem chung status + shape response that.
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.10
 */

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111'

let server: Server
let baseUrl: string
let fake: FakeConversationDb

beforeAll(async () => {
  fake = createFakeConversationDb()

  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createConversationsRouter({ db: fake.db as never }))
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

describe('GET /api/conversations', () => {
  it('tra danh sach conversation', async () => {
    fake.seedConversation({ id: CONVERSATION_ID, title: 'Chat 1' })

    const response = await fetch(`${baseUrl}/api/conversations`)
    const body = (await response.json()) as { items: Array<{ id: string; title: string }> }

    expect(response.status).toBe(200)
    expect(body.items.some((item) => item.id === CONVERSATION_ID)).toBe(true)
  })

  it('tra 400 khi limit vuot gioi han', async () => {
    const response = await fetch(`${baseUrl}/api/conversations?limit=999`)

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/conversations', () => {
  it('tao conversation moi → 201', async () => {
    const response = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Chat moi' }),
    })

    expect(response.status).toBe(201)
    const body = (await response.json()) as { title: string }
    expect(body.title).toBe('Chat moi')
  })

  it('tra 201 khi body rong (tieu de mac dinh)', async () => {
    const response = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(201)
  })
})

describe('PATCH /api/conversations/:id', () => {
  it('doi ten conversation → 200', async () => {
    fake.seedConversation({ id: CONVERSATION_ID, title: 'Cu' })

    const response = await fetch(`${baseUrl}/api/conversations/${CONVERSATION_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Moi' }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { title: string }
    expect(body.title).toBe('Moi')
  })

  it('tra 400 khi id khong phai UUID', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/khong-phai-uuid`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Moi' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('tra 400 khi body rong (khong co truong de cap nhat)', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/${CONVERSATION_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
  })

  it('tra 404 khi conversation khong ton tai', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/22222222-2222-4222-8222-222222222222`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Moi' }),
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('DELETE /api/conversations/:id', () => {
  it('xoa conversation → 204', async () => {
    const id = '33333333-3333-4333-8333-333333333333'
    fake.seedConversation({ id, title: 'Can xoa' })

    const response = await fetch(`${baseUrl}/api/conversations/${id}`, { method: 'DELETE' })

    expect(response.status).toBe(204)
  })

  it('tra 404 khi conversation khong ton tai', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/44444444-4444-4444-8444-444444444444`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('GET /api/conversations/:id/messages', () => {
  it('tra lich su + citations', async () => {
    const id = '55555555-5555-4555-8555-555555555555'
    fake.seedConversation({ id, title: 'Co lich su' })
    fake.seedMessage({ id: 'm1', conversationId: id, role: 'user', content: 'Hoi' })
    fake.seedCitation({ messageId: 'm1', idx: 1, url: 'https://a.test' })

    const response = await fetch(`${baseUrl}/api/conversations/${id}/messages`)
    const body = (await response.json()) as {
      conversation: { id: string }
      messages: Array<{ id: string; citations: unknown[] }>
    }

    expect(response.status).toBe(200)
    expect(body.conversation.id).toBe(id)
    expect(body.messages[0]?.citations).toHaveLength(1)
  })

  it('tra 400 khi id khong phai UUID', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/abc/messages`)

    expect(response.status).toBe(400)
  })

  it('tra 404 khi conversation khong ton tai', async () => {
    const response = await fetch(
      `${baseUrl}/api/conversations/66666666-6666-4666-8666-666666666666/messages`,
    )

    expect(response.status).toBe(404)
  })
})
