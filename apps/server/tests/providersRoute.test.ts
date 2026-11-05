import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createProvidersRouter } from '../src/routes/providers.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import { ProviderRegistry } from '../src/providers/registry.js'
import {
  createFakeProviderKeyDb,
  type FakeProviderKeyDb,
} from './helpers/fakeProviderKeyDb.js'

/**
 * Unit test cho route provider + BYOK key (FR-UX-02 — T-M1-25).
 *
 * Dung Express that de kiem chung status + shape response thuc te.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

const MASTER_KEY = 'a'.repeat(64)

let server: Server
let baseUrl: string
let fake: FakeProviderKeyDb

beforeAll(async () => {
  fake = createFakeProviderKeyDb()

  const registry = new ProviderRegistry({
    defaultProvider: 'mock',
    fallbacks: [],
    groqModel: 'openai/gpt-oss-120b',
    openRouterModel: 'google/gemini-2.5-flash',
    geminiModel: 'gemini-3.6-flash',
  })

  const app = express()
  app.use(express.json())
  app.use(
    API_BASE_PATH,
    createProvidersRouter({
      db: fake.db as never,
      registry,
      envKeys: {},
      masterKey: MASTER_KEY,
    }),
  )
  // Middleware chuan hoa loi nhu tren server that → AppError ra error code chuan.
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

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Stub fetch cho **provider ngoai** nhung van cho request toi server test
 * (localhost) di that — neu stub ca global fetch thi client cua test cung bi
 * intercept → test thanh loi gia.
 */
function stubProviderFetch(response: {
  ok: boolean
  status: number
  text: () => Promise<string>
}): void {
  const originalFetch = globalThis.fetch
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    if (url.includes('127.0.0.1') || url.includes('localhost')) {
      return originalFetch(input as never, init)
    }

    return response as unknown as Response
  })
}

describe('GET /api/providers', () => {
  it('tra danh sach provider voi keySource/available/models', async () => {
    const response = await fetch(`${baseUrl}/api/providers`)

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      items: { id: string; keySource: string; available: boolean; models: string[] }[]
    }

    expect(Array.isArray(body.items)).toBe(true)
    const groq = body.items.find((item) => item.id === 'groq')
    expect(groq?.keySource).toBe('none')
    expect(groq?.available).toBe(false)
    expect(groq?.models).toEqual(['openai/gpt-oss-120b'])
  })

  it('khong bao gio tra key goc trong danh sach provider', async () => {
    const response = await fetch(`${baseUrl}/api/providers`)
    const text = await response.text()

    expect(text).not.toContain('gsk_')
    expect(text).not.toContain('apiKey')
  })
})

describe('POST /api/providers/keys', () => {
  it('luu key va tra masked (khong tra key goc)', async () => {
    const response = await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'groq', apiKey: 'gsk_secret_value_1234' }),
    })

    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      id: string
      providerId: string
      label: string
      masked: string
    }

    expect(body.masked).toBe('****1234')
    expect(body.providerId).toBe('groq')
    expect(body.label).toBe('default')
    expect(JSON.stringify(body)).not.toContain('gsk_secret_value_1234')
  })

  it('tra VALIDATION_ERROR khi body sai', async () => {
    const response = await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'khong-ton-tai', apiKey: 'short' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('tra VALIDATION_ERROR khi thieu apiKey', async () => {
    const response = await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'groq' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/providers/keys', () => {
  it('tra danh sach key da che', async () => {
    await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'openrouter', apiKey: 'sk_or_test_9999' }),
    })

    const response = await fetch(`${baseUrl}/api/providers/keys`)

    expect(response.status).toBe(200)
    const text = await response.text()
    const body = JSON.parse(text) as { items: { masked: string }[] }
    expect(body.items.length).toBeGreaterThan(0)
    expect(body.items.some((item) => item.masked === '****9999')).toBe(true)
    expect(text).not.toContain('sk_or_test_9999')
  })
})

describe('POST /api/providers/keys/:id/test', () => {
  it('tra ok = true cho provider khong can key', async () => {
    const created = await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'mock', apiKey: 'bat-ky-1234' }),
    })
    const record = (await created.json()) as { id: string }

    const response = await fetch(`${baseUrl}/api/providers/keys/${record.id}/test`, {
      method: 'POST',
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; latencyMs: number }
    expect(body.ok).toBe(true)
    expect(body.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('tra ok = false kem error khi provider tu choi key', async () => {
    const created = await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'groq', apiKey: 'gsk_wrong_key_4321' }),
    })
    const record = (await created.json()) as { id: string }

    stubProviderFetch({ ok: false, status: 401, text: async () => 'Unauthorized' })

    const response = await fetch(`${baseUrl}/api/providers/keys/${record.id}/test`, {
      method: 'POST',
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
    expect(body.error).toContain('401')
  })

  it('tra 404 khi id khong ton tai', async () => {
    const response = await fetch(`${baseUrl}/api/providers/keys/khong-ton-tai/test`, {
      method: 'POST',
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})

describe('DELETE /api/providers/keys/:id', () => {
  it('xoa key → 204', async () => {
    const created = await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'gemini', apiKey: 'AIza_test_7777' }),
    })
    const record = (await created.json()) as { id: string }

    const response = await fetch(`${baseUrl}/api/providers/keys/${record.id}`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(204)
  })

  it('tra 404 khi xoa id khong ton tai', async () => {
    const response = await fetch(`${baseUrl}/api/providers/keys/khong-ton-tai`, {
      method: 'DELETE',
    })

    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })
})
