import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listProviderModels } from '../src/lib/providerClient'

/**
 * Unit test cho `listProviderModels` (T-M2-02 — FR-PROVIDER-03).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
 */

/** Mock `fetch` co chu ky chuan de doc duoc `calls[0][1]` (RequestInit). */
type MockFetch = ReturnType<
  typeof vi.fn<
    (
      url: string,
      init?: RequestInit,
    ) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
  >
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

describe('listProviderModels', () => {
  it('tra danh sach model + nguon discovery', async () => {
    stubOk({
      providerId: 'groq',
      models: ['llama-3.3-70b', 'openai/gpt-oss-120b'],
      source: 'live',
    })

    const result = await listProviderModels('groq')

    expect(result.providerId).toBe('groq')
    expect(result.models).toEqual(['llama-3.3-70b', 'openai/gpt-oss-120b'])
    expect(result.source).toBe('live')
  })

  it('goi duong dan API dung theo provider id', async () => {
    const fetchMock = stubOk({ providerId: 'mock', models: [], source: 'live' })

    await listProviderModels('mock')

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/providers/mock/models')
  })

  it('ma hoa provider id trong duong dan', async () => {
    const fetchMock = stubOk({ providerId: 'mock', models: [], source: 'live' })

    await listProviderModels('openrouter')

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/providers/openrouter/models')
  })

  it('nem loi chuan hoa khi server tra 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () =>
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Khong tim thay provider' } }),
      })),
    )

    await expect(listProviderModels('mock')).rejects.toThrow('Khong tim thay provider')
  })

  it('nem loi khi response sai schema (khong lam UI crash)', async () => {
    stubOk({ items: [] })

    await expect(listProviderModels('mock')).rejects.toThrow('khong dung schema')
  })
})
