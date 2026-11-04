import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH, ERROR_CODES } from '@sidekick/shared'
import { createExtractRouter } from '../src/routes/extract.js'

/**
 * Unit test cho route trich xuat context.
 *
 * Nguyen tac quan trong: loi nghiep vu (PDF scan, khong co caption) phai tra
 * HTTP 200 kem `error` trong body — client khong phan biet theo status.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

/** Server Express thật de test qua HTTP that (khong mock router). */
let server: Server
let baseUrl: string

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createExtractRouter())

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

describe('POST /api/extract/pdf', () => {
  it('tra 400 khi body sai schema', async () => {
    const response = await fetch(`${baseUrl}/api/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'html', url: 'https://example.com' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('tra 400 khi url khong hop le', async () => {
    const response = await fetch(`${baseUrl}/api/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pdf', url: 'khong-phai-url' }),
    })

    expect(response.status).toBe(400)
  })

  it('tra 200 + error code khi khong fetch duoc PDF (SSRF chan)', async () => {
    // `127.0.0.1` bi `safeFetch` chan → loi nghiep vu, phai ra HTTP 200.
    const response = await fetch(`${baseUrl}/api/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pdf', url: 'http://127.0.0.1:9/a.pdf' }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; text: string; error?: string }
    expect(body.kind).toBe('pdf')
    expect(body.text).toBe('')
    expect(body.error).toBe(ERROR_CODES.CONTEXT_PDF_UNREACHABLE)
  })
})

describe('POST /api/extract/youtube', () => {
  it('tra 400 khi body sai schema', async () => {
    const response = await fetch(`${baseUrl}/api/extract/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pdf', url: 'https://www.youtube.com/watch?v=abc' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('tra 200 + error code khi khong lay duoc transcript', async () => {
    // Host khong ton tai → loi nghiep vu → van HTTP 200.
    const response = await fetch(`${baseUrl}/api/extract/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'youtube',
        url: 'https://this-host-does-not-exist-sidekick-test.invalid/watch?v=abc',
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; text: string; error?: string }
    expect(body.kind).toBe('youtube')
    expect(body.error).toBe(ERROR_CODES.CONTEXT_TRANSCRIPT_UNAVAILABLE)
  })
})
