import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH, LIMITS } from '@sidekick/shared'
import { createChatRouter } from '../src/routes/chat.js'
import { errorHandler, notFoundHandler } from '../src/middleware/error.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Regression test end-to-end cho bug T-M2-23: "khong chat duoc" sau khi
 * dinh kem tai lieu.
 *
 * ## Bug
 *
 * `excerpt` do server/extension sinh = `slice(0, 500)` + `"..."` → **503**
 * ky tu → `contextItemSchema` reject → `chatRequestSchema` reject →
 * `POST /api/chat` tra **400 "Body chat khong hop le"** → panel **khong chat
 * duoc**.
 *
 * ## Fix
 *
 * `excerpt` bay gio **tu cat** trong schema → request van hop le → chat chay
 * binh thuong.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29.4.2
 */

let server: Server
let baseUrl: string

/** Tao provider gia lap — stream 1 chunk text. */
function makeProvider(): ProviderAdapter {
  return {
    id: 'mock',
    name: 'Mock',
    requiresKey: false,
    supportsVision: () => true,
    testKey: async () => ({ ok: true }),
    listModels: async () => ['mock-model'],
    resolveModel: (requested?: string) => requested ?? 'mock-model',
    async *stream() {
      yield { kind: 'token', text: 'Xin chao' }
    },
  }
}

/** Tao registry gia lap. */
function makeRegistry(provider: ProviderAdapter): ProviderRegistry {
  return {
    get: (id: string) => (id === 'mock' ? provider : undefined),
    require: (id: string) => {
      if (id !== 'mock') throw new Error(`Khong tim thay provider "${id}"`)
      return provider
    },
    list: () => [provider],
    getFallbackChain: () => ['mock'] as never,
    getFallbacks: () => [] as never,
  } as unknown as ProviderRegistry
}

/** DB gia lap — moi lenh ghi deu thanh cong. */
function makeDb(): {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
} {
  const insert = vi.fn(() => ({
    values: () => {
      const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
        onConflictDoNothing: () => Promise<unknown[]>
        returning: () => Promise<unknown[]>
      }
      promise.onConflictDoNothing = () => Promise.resolve([])
      promise.returning = () => Promise.resolve([])
      return promise
    },
  }))
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({ limit: async () => [] }),
        limit: async () => [],
      }),
    }),
  }))
  return { insert, select }
}

beforeAll(async () => {
  const app = express()
  app.use(express.json())
  app.use(API_BASE_PATH, createChatRouter({
    db: makeDb() as never,
    registry: makeRegistry(makeProvider()),
    envKeys: {},
    masterKey: undefined,
    logFullContent: false,
    logRequests: false,
    logContextSnapshot: false,
  }))
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

describe('POST /api/chat — context co excerpt vuot gioi han', () => {
  it('KHONG tra 400 khi excerpt dai (fix T-M2-23 — "khong chat duoc")', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Tom tat tai lieu' }],
        context: {
          items: [
            {
              id: 'doc-1',
              kind: 'file',
              tier: 'attachment',
              title: 'sach.pdf',
              text: 'Noi dung sach day du',
              // Dung format "cat 500 + ..." → 503 ky tu → TRUOC day bi reject.
              excerpt: `${'a'.repeat(LIMITS.MAX_EXCERPT_CHARS)}...`,
              fileName: 'sach.pdf',
              mimeType: 'application/pdf',
            },
          ],
        },
      }),
    })

    expect(response.status).toBe(200)

    const body = await response.text()
    expect(body).toContain('event: token')
    expect(body).not.toContain('Body chat không hợp lệ')
  })

  it('context hop le van hoat dong binh thuong (khong regression)', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Xin chao' }],
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('event: token')
  })

  it('context item thieu `title` van bi reject 400 (khong nem loai validation)', async () => {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Xin chao' }],
        context: {
          items: [{ id: 'doc-1', kind: 'file', tier: 'attachment' }],
        },
      }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
