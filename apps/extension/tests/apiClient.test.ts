import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getBffUrl, setBffUrl, fetchJson, ApiError, DEFAULT_BFF_URL } from '../src/lib/apiClient'

/**
 * Unit test cho API client cua extension.
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('getBffUrl', () => {
  it('tra mac dinh khi storage rong', async () => {
    await expect(getBffUrl()).resolves.toBe(DEFAULT_BFF_URL)
  })

  it('doc storage va bo dau slash cuoi', async () => {
    await setBffUrl('http://example.test:9000/')
    await expect(getBffUrl()).resolves.toBe('http://example.test:9000')
  })
})

describe('fetchJson', () => {
  it('tra payload khi response ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'ok' }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchJson<{ status: string }>('/api/health')
    expect(result).toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('nem ApiError voi code/message tu error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Sai payload' } }),
      })),
    )

    await expect(fetchJson('/api/chat')).rejects.toBeInstanceOf(ApiError)
    await expect(fetchJson('/api/chat')).rejects.toThrow('Sai payload')
  })

  it('nem ApiError fallback khi body khong phai JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Error',
      })),
    )

    await expect(fetchJson('/api/health')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    })
  })
})
