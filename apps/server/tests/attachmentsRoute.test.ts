import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH } from '@sidekick/shared'
import { createAttachmentsRouter } from '../src/routes/attachments.js'

/**
 * Unit test cho route `GET /api/attachments/:id` (FR-VISION-01 — T-M1-24).
 *
 * Route tra **binary** (khong phai JSON) → dung server Express that de
 * kiem chung `Content-Type` + `Content-Length`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.2
 */

/** Server Express thật de test qua HTTP that. */
let server: Server
let baseUrl: string

/** DB gia lap — `getAttachment` duoc mock qua module. */
const getAttachmentMock = vi.fn()

vi.mock('../src/services/attachmentService.js', () => ({
  getAttachment: (...args: unknown[]) => getAttachmentMock(...args),
}))

beforeAll(async () => {
  const app = express()
  app.use(API_BASE_PATH, createAttachmentsRouter({ db: {} as never }))

  server = await new Promise<Server>((resolve) => {
    const created = app.listen(0, () => resolve(created))
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('GET /api/attachments/:id', () => {
  it('tra binary dung Content-Type', async () => {
    const payload = Buffer.from('aGVsbG8=', 'base64')
    getAttachmentMock.mockResolvedValue({ mimeType: 'image/png', data: payload })

    const response = await fetch(`${baseUrl}/api/attachments/att-1`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('content-length')).toBe(String(payload.byteLength))

    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.toString('utf-8')).toBe('hello')
  })

  it('tra 404 khi khong tim thay anh', async () => {
    getAttachmentMock.mockResolvedValue(undefined)

    const response = await fetch(`${baseUrl}/api/attachments/khong-ton-tai`)

    expect(response.status).toBe(404)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('tra 500 khi DB nem loi', async () => {
    getAttachmentMock.mockRejectedValue(new Error('db down'))

    const response = await fetch(`${baseUrl}/api/attachments/att-2`)

    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
