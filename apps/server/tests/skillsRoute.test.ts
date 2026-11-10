import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createSkillsRouter } from '../src/routes/skills.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import { createFakeConversationDb } from './helpers/fakeConversationDb.js'
import { BUILTIN_SKILLS } from '../src/skills/builtin.js'

/**
 * Unit test cho route skills (T-M2-04 — FR-SKILL-01/02/03).
 *
 * AC goc: "CRUD skill qua drawer" → `GET/POST/PATCH/DELETE /api/skills` +
 * map loi ve `ERROR_CODES` chuan.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.25
 */

let server: Server
let baseUrl: string
const fake = createFakeConversationDb()

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createSkillsRouter({ db: fake.db as never }))
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

describe('GET /api/skills', () => {
  it('tra danh sach skill (200)', async () => {
    const response = await fetch(`${baseUrl}/api/skills`)
    const body = (await response.json()) as {
      items: Array<{ name: string; scope: string }>
    }

    expect(response.status).toBe(200)
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.some((item) => item.scope === 'builtin')).toBe(true)
  })

  it('loc scope=builtin → chi built-in', async () => {
    const response = await fetch(`${baseUrl}/api/skills?scope=builtin`)
    const body = (await response.json()) as {
      items: Array<{ scope: string }>
    }

    expect(body.items.every((item) => item.scope === 'builtin')).toBe(true)
    expect(body.items).toHaveLength(BUILTIN_SKILLS.length)
  })

  it('scope khong hop le → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/skills?scope=khac`)

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // --- FR-SKILL-07: loc theo tag (T-M2-06) ---

  it('loc tags= → chi tra skill co tag do', async () => {
    await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'skill-tag-hoc',
        promptTemplate: 'x',
        tags: ['b-hoc'],
      }),
    })

    const response = await fetch(`${baseUrl}/api/skills?tags=b-hoc`)
    const body = (await response.json()) as {
      items: Array<{ name: string; tags: string[] }>
    }

    expect(response.status).toBe(200)
    expect(body.items.length).toBeGreaterThan(0)
    expect(
      body.items.every((item) => item.tags.includes('b-hoc')),
    ).toBe(true)
  })

  it('loc tags= nhieu tag → khop neu co it nhat 1', async () => {
    const response = await fetch(`${baseUrl}/api/skills?tags=b-hoc,khong-ton-tai`)
    const body = (await response.json()) as {
      items: Array<{ tags: string[] }>
    }

    expect(response.status).toBe(200)
    expect(body.items.length).toBeGreaterThan(0)
    expect(
      body.items.every((item) => item.tags.includes('b-hoc')),
    ).toBe(true)
  })

  it('loc tags= → chan ca built-in va skill cua user', async () => {
    const response = await fetch(`${baseUrl}/api/skills?tags=summary`)
    const body = (await response.json()) as {
      items: Array<{ scope: string; tags: string[] }>
    }

    expect(response.status).toBe(200)
    expect(
      body.items.every((item) => item.tags.includes('summary')),
    ).toBe(true)
  })

  it('q= khop ca mo ta', async () => {
    const response = await fetch(`${baseUrl}/api/skills?q=dich`)
    const body = (await response.json()) as {
      items: Array<{ name: string; description: string }>
    }

    expect(response.status).toBe(200)
    expect(
      body.items.every(
        (item) =>
          item.name.toLowerCase().includes('dich') ||
          item.description.toLowerCase().includes('dich'),
      ),
    ).toBe(true)
  })
})

describe('POST /api/skills', () => {
  it('tao skill moi → 201 + tra skill', async () => {
    const response = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Soan Email',
        description: 'Soan email ngan gon',
        promptTemplate: 'Soan email ngan gon theo yeu cau.',
        tags: ['email'],
      }),
    })
    const body = (await response.json()) as { name: string; scope: string }

    expect(response.status).toBe(201)
    expect(body.name).toBe('soan-email')
    expect(body.scope).toBe('user')
  })

  it('body sai → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'a' }),
    })

    expect(response.status).toBe(400)
  })

  it('ten trung → 409 CONFLICT', async () => {
    const response = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'soan-email',
        promptTemplate: 'x',
      }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
  })
})

describe('PATCH /api/skills/:id', () => {
  it('sua skill cua user → 200', async () => {
    const created = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'skill-patch', promptTemplate: 'x' }),
    })
    const skill = (await created.json()) as { id: string }

    const response = await fetch(`${baseUrl}/api/skills/${skill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Mo ta moi' }),
    })
    const body = (await response.json()) as { description: string }

    expect(response.status).toBe(200)
    expect(body.description).toBe('Mo ta moi')
  })

  it('id khong ton tai → 404 NOT_FOUND', async () => {
    const response = await fetch(`${baseUrl}/api/skills/khong-ton-tai`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('sua built-in → 403 FORBIDDEN', async () => {
    const builtin = BUILTIN_SKILLS[0]
    const response = await fetch(`${baseUrl}/api/skills/${builtin?.id ?? ''}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('body rong → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/skills/bat-ky`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.status).toBe(400)
  })
})

describe('DELETE /api/skills/:id', () => {
  it('xoa skill cua user → 204', async () => {
    const created = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'skill-xoa', promptTemplate: 'x' }),
    })
    const skill = (await created.json()) as { id: string }

    const response = await fetch(`${baseUrl}/api/skills/${skill.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
  })

  it('id khong ton tai → 404 NOT_FOUND', async () => {
    const response = await fetch(`${baseUrl}/api/skills/khong-ton-tai`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(404)
  })

  it('xoa built-in → 403 FORBIDDEN', async () => {
    const builtin = BUILTIN_SKILLS[0]
    const response = await fetch(`${baseUrl}/api/skills/${builtin?.id ?? ''}`, {
      method: 'DELETE',
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(403)
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
