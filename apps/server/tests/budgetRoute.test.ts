import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createBudgetRouter } from '../src/routes/budget.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import { createFakeBudgetDb } from './helpers/fakeBudgetDb.js'

/**
 * Unit test cho route budget cap (T-M2-03b — FR-PROVIDER-06).
 *
 * AC goc: "Cấu hình hạn mức lưu phía server" → `GET` đọc, `PUT` ghi,
 * validate Zod ở biên.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.24
 */

let server: Server
let baseUrl: string
const fake = createFakeBudgetDb()

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createBudgetRouter({ db: fake.db as never }))
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

describe('GET /api/budget', () => {
  it('tra trang thai budget mac dinh (200)', async () => {
    const response = await fetch(`${baseUrl}/api/budget`)
    const body = (await response.json()) as {
      state: string
      spentUsd: number
      limitUsd: number
      period: string
      settings: { enabled: boolean }
    }

    expect(response.status).toBe(200)
    expect(body.state).toBe('disabled')
    expect(body.spentUsd).toBe(0)
    expect(body.settings.enabled).toBe(false)
  })
})

describe('PUT /api/budget', () => {
  it('luu cau hinh hop le → 200 + tra trang thai moi', async () => {
    const response = await fetch(`${baseUrl}/api/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        limitUsd: 5,
        period: 'daily',
        warnThresholdPercent: 80,
        hardBlock: true,
      }),
    })
    const body = (await response.json()) as {
      state: string
      limitUsd: number
      settings: { enabled: boolean; period: string }
    }

    expect(response.status).toBe(200)
    expect(body.settings.enabled).toBe(true)
    expect(body.settings.period).toBe('daily')
    expect(body.limitUsd).toBe(5)
  })

  it('patch 1 field → giu nguyen field khac', async () => {
    const response = await fetch(`${baseUrl}/api/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limitUsd: 9 }),
    })
    const body = (await response.json()) as {
      settings: { enabled: boolean; limitUsd: number; period: string }
    }

    expect(response.status).toBe(200)
    expect(body.settings.limitUsd).toBe(9)
    expect(body.settings.enabled).toBe(true)
    expect(body.settings.period).toBe('daily')
  })

  it('body sai kieu du lieu → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: 'co' }),
    })
    const body = (await response.json()) as { error: { code: string } }

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('han muc am → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limitUsd: -5 }),
    })

    expect(response.status).toBe(400)
  })

  it('ky khong hop le → 400 VALIDATION_ERROR', async () => {
    const response = await fetch(`${baseUrl}/api/budget`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period: 'weekly' }),
    })

    expect(response.status).toBe(400)
  })
})
