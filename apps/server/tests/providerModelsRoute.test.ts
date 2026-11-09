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
 * Unit test cho `GET /api/providers/:id/models` (T-M2-02 — FR-PROVIDER-03).
 *
 * Kiem chung:
 *  - Tra danh sach model **dong** khi provider goi `GET /models` thanh cong.
 *  - Fallback ve model mac dinh khi provider loi → `source: 'fallback'`.
 *  - Tu choi provider id khong hop le → 400.
 *  - **Khong** ro ri key goc ra ngoai.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
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
 * (localhost) di that.
 *
 * @param response - Response se tra cho moi request ra ngoai.
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

describe('GET /api/providers/:id/models', () => {
  it('tra danh sach model cua provider', async () => {
    const response = await fetch(`${baseUrl}/api/providers/mock/models`)

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      providerId: string
      models: string[]
      source: string
    }

    expect(body.providerId).toBe('mock')
    expect(Array.isArray(body.models)).toBe(true)
    expect(body.models.length).toBeGreaterThan(0)
    expect(['live', 'fallback']).toContain(body.source)
  })

  it('tra 400 khi provider id khong hop le', async () => {
    const response = await fetch(`${baseUrl}/api/providers/khong-ton-tai/models`)

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('fallback ve model mac dinh khi provider that bai', async () => {
    // Provider `groq` can key → khong co key → `listModels` goi API that bai.
    stubProviderFetch({ ok: false, status: 401, text: async () => 'Unauthorized' })

    const response = await fetch(`${baseUrl}/api/providers/groq/models`)

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      providerId: string
      models: string[]
      source: string
    }

    expect(body.providerId).toBe('groq')
    expect(body.source).toBe('fallback')
    expect(body.models).toEqual(['openai/gpt-oss-120b'])
  })

  it('khong ro ri key goc ra ngoai', async () => {
    await fetch(`${baseUrl}/api/providers/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 'groq', apiKey: 'gsk_secret_models_1234' }),
    })

    const response = await fetch(`${baseUrl}/api/providers/groq/models`)
    const text = await response.text()

    expect(text).not.toContain('gsk_secret_models_1234')
  })
})
