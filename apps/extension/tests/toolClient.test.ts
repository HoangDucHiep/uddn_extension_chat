import { afterEach, describe, expect, it, vi } from 'vitest'
import { approveToolCall, denyToolCall, listTools } from '../src/lib/toolClient.js'

/**
 * Unit test cho client tool (FR-TOOLS-01/04 — T-M2-09).
 *
 * Kiem chung: dung URL + method cho list / approve / deny.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.5
 */

/** Mock fetch tra payload given. */
function stubFetch(payload: unknown, ok = true, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listTools', () => {
  it('goi GET /api/tools va tra ve danh sach tool', async () => {
    const fetchMock = stubFetch({
      items: [{ name: 'calculator', description: 'Tinh toan', requiresApproval: false }],
    })

    const result = await listTools()

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.name).toBe('calculator')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/tools')
    expect(call[1].method).toBeUndefined()
  })
})

describe('approveToolCall', () => {
  it('goi POST /api/tools/:id/approve', async () => {
    const fetchMock = stubFetch({ id: 'call-1', approvedByUser: true })

    const result = await approveToolCall('call-1')

    expect(result.approvedByUser).toBe(true)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/tools/call-1/approve')
    expect(call[1].method).toBe('POST')
  })
})

describe('denyToolCall', () => {
  it('goi POST /api/tools/:id/deny', async () => {
    const fetchMock = stubFetch({ id: 'call-1', approvedByUser: false })

    const result = await denyToolCall('call-1')

    expect(result.approvedByUser).toBe(false)
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/tools/call-1/deny')
    expect(call[1].method).toBe('POST')
  })

  it('id chua doi → encode trong URL', async () => {
    const fetchMock = stubFetch({ id: 'a/b', approvedByUser: false })

    await denyToolCall('a/b')

    const call = fetchMock.mock.calls[0] as unknown as [string]
    expect(call[0]).toContain('a%2Fb')
  })

  it('BFF tra loi → throw', async () => {
    stubFetch({ error: { code: 'NOT_FOUND', message: 'Khong tim thay tool call' } }, false, 404)

    await expect(denyToolCall('khong-ton-tai')).rejects.toThrow('Khong tim thay tool call')
  })
})
