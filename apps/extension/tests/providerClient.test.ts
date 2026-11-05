import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiError } from '../src/lib/apiClient'
import {
  deleteProviderKey,
  listProviderKeys,
  listProviders,
  saveProviderKey,
  testProviderKey,
} from '../src/lib/providerClient'

/**
 * Unit test cho provider client cua extension (FR-UX-02 — T-M1-25).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

/** Mock `fetch` co chu ky chuan de doc duoc `calls[0][1]` (RequestInit). */
type MockFetch = ReturnType<
  typeof vi.fn<(url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>>
>

beforeEach(() => {
  vi.restoreAllMocks()
})

/** Mock fetch tra payload JSON thanh cong. */
function stubOk(payload: unknown): MockFetch {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('listProviders', () => {
  it('tra danh sach provider', async () => {
    stubOk({
      items: [
        {
          id: 'mock',
          name: 'Mock Provider',
          models: ['mock-model'],
          keySource: 'none',
          requiresKey: false,
          available: true,
        },
      ],
    })

    const items = await listProviders()

    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('mock')
  })

  it('goi duong dan API', async () => {
    const fetchMock = stubOk({ items: [] })

    await listProviders()

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/providers')
  })

  it('nem ApiError khi BFF tra loi chuan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () =>
          JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Loi noi bo' } }),
      })),
    )

    await expect(listProviders()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('listProviderKeys', () => {
  it('ra danh sach key da che', async () => {
    stubOk({
      items: [
        {
          id: '11111111-2222-4333-8444-555555555555',
          providerId: 'groq',
          label: 'default',
          masked: '****1234',
          createdAt: '2026-11-05T00:00:00.000Z',
        },
      ],
    })

    const items = await listProviderKeys()

    expect(items[0]?.masked).toBe('****1234')
  })
})

describe('saveProviderKey', () => {
  it('gui providerId + apiKey len BFF', async () => {
    const fetchMock = stubOk({
      id: '11111111-2222-4333-8444-555555555555',
      providerId: 'groq',
      label: 'default',
      masked: '****1234',
      createdAt: '2026-11-05T00:00:00.000Z',
    })

    const record = await saveProviderKey('groq', 'gsk_secret_1234')

    expect(record.masked).toBe('****1234')
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(String(init?.body)).toContain('"providerId":"groq"')
    expect(String(init?.body)).toContain('"apiKey":"gsk_secret_1234"')
  })

  it('gui them label khi duoc truyen', async () => {
    const fetchMock = stubOk({
      id: '11111111-2222-4333-8444-555555555555',
      providerId: 'groq',
      label: 'backup',
      masked: '****1234',
      createdAt: '2026-11-05T00:00:00.000Z',
    })

    await saveProviderKey('groq', 'gsk_secret_1234', 'backup')

    const init = fetchMock.mock.calls[0]?.[1]
    expect(String(init?.body)).toContain('"label":"backup"')
  })

  it('nem ApiError khi body khong hop le', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Sai payload' } }),
      })),
    )

    await expect(saveProviderKey('groq', 'short')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
    })
  })
})

describe('testProviderKey', () => {
  it('tra ket qua kiem tra', async () => {
    const fetchMock = stubOk({ ok: true, latencyMs: 42 })

    const result = await testProviderKey('key-1')

    expect(result.ok).toBe(true)
    expect(result.latencyMs).toBe(42)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/providers/keys/key-1/test')
  })

  it('tra ok = false kem error', async () => {
    stubOk({ ok: false, latencyMs: 10, error: '401 Unauthorized' })

    const result = await testProviderKey('key-1')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('401')
  })
})

describe('deleteProviderKey', () => {
  it('goi DELETE va khong nem loi khi 204', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 204,
      text: async () => '',
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteProviderKey('key-1')).resolves.toBeUndefined()

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('DELETE')
  })
})
