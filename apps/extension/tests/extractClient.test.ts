import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestExtract } from '../src/lib/extractClient.js'

/**
 * Unit test cho client trich xuat context PDF / YouTube.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestExtract', () => {
  it('goi dung endpoint theo kind', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ kind: 'pdf', text: 'Noi dung PDF', truncated: false }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await requestExtract('pdf', 'https://example.com/a.pdf')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/extract/pdf')
    expect(call[1].method).toBe('POST')
    expect(outcome.text).toBe('Noi dung PDF')
    expect(outcome.error).toBeUndefined()
  })

  it('goi endpoint youtube khi kind = youtube', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ kind: 'youtube', text: '[00:00] Hello', truncated: false }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await requestExtract('youtube', 'https://www.youtube.com/watch?v=abc')

    const call = fetchMock.mock.calls[0] as unknown as [string]
    expect(call[0]).toContain('/api/extract/youtube')
  })

  it('tra error (khong throw) khi BFF bao loi nghiep vu trong body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            kind: 'pdf',
            text: '',
            truncated: false,
            error: 'CONTEXT_PDF_NOT_READABLE',
            errorMessage: 'PDF scan',
          }),
      })),
    )

    const outcome = await requestExtract('pdf', 'https://example.com/a.pdf')

    expect(outcome.error).toBe('CONTEXT_PDF_NOT_READABLE')
    expect(outcome.errorMessage).toBe('PDF scan')
    expect(outcome.text).toBe('')
  })

  it('tra error (khong throw) khi BFF khong phat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Failed to fetch')
      }),
    )

    const outcome = await requestExtract('pdf', 'https://example.com/a.pdf')

    expect(outcome.error).toBe('CONTEXT_EXTRACT_FAILED')
    expect(outcome.text).toBe('')
  })
})
