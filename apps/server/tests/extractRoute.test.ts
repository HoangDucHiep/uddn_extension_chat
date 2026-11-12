import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH, DOCUMENT, ERROR_CODES } from '@sidekick/shared'
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
  // Limit lon hon mac dinh 100kb — tai lieu co the toi 8 MB (base64 ~10.7 MB).
  app.use(express.json({ limit: '16mb' }))
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

describe('POST /api/extract/document', () => {
  it('tra 400 khi body sai schema', async () => {
    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'a.txt' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('tra 200 + text khi file txt hop le', async () => {
    const data = Buffer.from('Noi dung tai lieu thu nghiem', 'utf-8').toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'ghi-chu.txt', mimeType: 'text/plain', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      kind: string
      text: string
      title?: string
      excerpt?: string
      truncated: boolean
      error?: string
    }
    expect(body.kind).toBe('text')
    expect(body.text).toBe('Noi dung tai lieu thu nghiem')
    expect(body.title).toBe('ghi-chu.txt')
    expect(body.truncated).toBe(false)
    expect(body.error).toBeUndefined()
  })

  it('tra 200 + error code khi dinh dang khong ho tro', async () => {
    const data = Buffer.from('binary', 'utf-8').toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'file.xlsx', mimeType: 'application/vnd.ms-excel', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { text: string; error?: string }
    expect(body.text).toBe('')
    expect(body.error).toBe(ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE)
  })

  it('tra 200 + error code khi file rong', async () => {
    const data = Buffer.from('   ', 'utf-8').toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'rong.txt', mimeType: 'text/plain', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { text: string; error?: string }
    expect(body.error).toBe(ERROR_CODES.DOCUMENT_EMPTY)
  })

  it('tra 413 khi file vuot gioi han kich thuoc', async () => {
    // 8 MB file → base64 ~10.7 MB → byte thuc > `DOCUMENT.MAX_BYTES`.
    const data = Buffer.alloc(DOCUMENT.MAX_BYTES + 1, 0x61).toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'lon.txt', mimeType: 'text/plain', data }),
    })

    expect(response.status).toBe(413)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE)
  })
})
