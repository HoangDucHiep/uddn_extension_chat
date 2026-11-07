import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createLogsRouter } from '../src/routes/logs.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import { createFakeRequestLogDb } from './helpers/fakeRequestLogDb.js'

/**
 * Unit test cho route doc log + usage (T-M1-14).
 *
 * AC: "API doc log **chi metadata** — khong lo prompt/response/snapshot".
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.16
 */

let server: Server
let baseUrl: string
const fake = createFakeRequestLogDb()

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createLogsRouter({ db: fake.db as never }))
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

describe('GET /api/logs', () => {
  it('tra danh sach log + tong so dong', async () => {
    fake.seed({ provider: 'gemini', model: 'gemini-2.5-flash' })

    const response = await fetch(`${baseUrl}/api/logs?limit=10`)
    const body = (await response.json()) as { items: unknown[]; total: number }

    expect(response.status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.total).toBeGreaterThan(0)
  })

  it('CHI metadata — khong co promptText / responseText / contextSnapshot', async () => {
    fake.seed({
      promptText: 'NOI DUNG NHAY CAM',
      responseText: 'TRA LOI NHAY CAM',
      contextSnapshot: [{ text: 'SNAPSHOT NHAY CAM' }],
    })

    const response = await fetch(`${baseUrl}/api/logs?limit=50`)
    const raw = await response.text()

    expect(raw).not.toContain('NOI DUNG NHAY CAM')
    expect(raw).not.toContain('TRA LOI NHAY CAM')
    expect(raw).not.toContain('SNAPSHOT NHAY CAM')
    expect(raw).not.toContain('promptText')
    expect(raw).not.toContain('responseText')
    expect(raw).not.toContain('contextSnapshot')

    const body = JSON.parse(raw) as { items: Array<Record<string, unknown>> }
    const first = body.items[0]
    expect(first).toBeDefined()
    expect(first).not.toHaveProperty('promptText')
    expect(first).not.toHaveProperty('responseText')
    expect(first).not.toHaveProperty('contextSnapshot')
  })

  it('truong metadata dang dung (requestId, provider, model, token, cost, ttft, latency)', async () => {
    fake.seed({
      requestId: 'req-metadata-1',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      tokensIn: 111,
      tokensOut: 222,
      costUsd: '0.012345',
      ttftMs: 333,
      latencyMs: 444,
    })

    const response = await fetch(`${baseUrl}/api/logs?limit=50`)
    const body = (await response.json()) as { items: Array<Record<string, unknown>> }
    const row = body.items.find((item) => item['requestId'] === 'req-metadata-1')

    expect(row).toBeDefined()
    expect(row?.['provider']).toBe('groq')
    expect(row?.['model']).toBe('openai/gpt-oss-120b')
    expect(row?.['tokensIn']).toBe(111)
    expect(row?.['tokensOut']).toBe(222)
    expect(row?.['costUsd']).toBe(0.012345)
    expect(row?.['ttftMs']).toBe(333)
    expect(row?.['latencyMs']).toBe(444)
  })

  it('loc theo provider', async () => {
    fake.seed({ provider: 'openrouter' })

    const response = await fetch(`${baseUrl}/api/logs?provider=openrouter`)
    const body = (await response.json()) as { items: Array<{ provider: string }> }

    expect(response.status).toBe(200)
    expect(body.items.every((item) => item.provider === 'openrouter')).toBe(true)
  })

  it('tra 400 khi limit khong phai so', async () => {
    const response = await fetch(`${baseUrl}/api/logs?limit=abc`)

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('tra 400 khi limit vuot gioi han', async () => {
    const response = await fetch(`${baseUrl}/api/logs?limit=9999`)

    expect(response.status).toBe(400)
  })

  it('tra 400 khi `from` khong phai ISO datetime', async () => {
    const response = await fetch(`${baseUrl}/api/logs?from=khong-phai-ngay`)

    expect(response.status).toBe(400)
  })

  it('tra 400 khi `conversationId` khong phai uuid', async () => {
    const response = await fetch(`${baseUrl}/api/logs?conversationId=abc`)

    expect(response.status).toBe(400)
  })
})

describe('GET /api/usage', () => {
  it('tra tong hop token + chi phi theo ngay', async () => {
    const response = await fetch(`${baseUrl}/api/usage`)
    const body = (await response.json()) as {
      totalTokens: number
      totalCostUsd: number
      byDay: Array<{ date: string; totalTokens: number; requests: number }>
    }

    expect(response.status).toBe(200)
    expect(body.totalTokens).toBeGreaterThan(0)
    expect(body.totalCostUsd).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(body.byDay)).toBe(true)
  })

  it('khong lo noi dung nhay cam', async () => {
    const response = await fetch(`${baseUrl}/api/usage`)
    const raw = await response.text()

    expect(raw).not.toContain('NOI DUNG NHAY CAM')
    expect(raw).not.toContain('promptText')
    expect(raw).not.toContain('responseText')
  })

  it('tra 400 khi `to` khong phai ISO datetime', async () => {
    const response = await fetch(`${baseUrl}/api/usage?to=abc`)

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
