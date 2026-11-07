import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiError } from '../src/lib/apiClient'
import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations,
  updateConversation,
} from '../src/lib/conversationClient'

/**
 * Unit test cho conversation client cua extension (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

/** Mock `fetch` co chu ky chuan de doc duoc `calls[0][1]` (RequestInit). */
type MockFetch = ReturnType<
  typeof vi.fn<
    (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
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

/** Mock fetch tra loi chuan cua BFF. */
function stubError(status: number, code: string, message: string): MockFetch {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { code, message } }),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('listConversations', () => {
  it('tra danh sach conversation', async () => {
    stubOk({ items: [] })

    const result = await listConversations()

    expect(result.items).toEqual([])
  })

  it('them query vao URL khi co q', async () => {
    const fetchMock = stubOk({ items: [] })

    await listConversations({ q: 'abc' })

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('/api/conversations?')
    expect(url).toContain('q=abc')
  })

  it('them archived=true vao URL', async () => {
    const fetchMock = stubOk({ items: [] })

    await listConversations({ archived: true })

    const url = String(fetchMock.mock.calls[0]?.[0])
    expect(url).toContain('archived=true')
  })
})

describe('createConversation', () => {
  it('POST body chua title', async () => {
    const fetchMock = stubOk({ id: 'c1', title: 'Moi' })

    await createConversation('Moi')

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('POST')
    expect(String(init?.body)).toContain('"title":"Moi"')
  })

  it('POST body rong khi khong co title', async () => {
    const fetchMock = stubOk({ id: 'c1', title: 'Moi' })

    await createConversation()

    const init = fetchMock.mock.calls[0]?.[1]
    expect(String(init?.body)).toBe('{}')
  })
})

describe('updateConversation', () => {
  it('PATCH voi patch body', async () => {
    const fetchMock = stubOk({ id: 'c1', title: 'Moi' })

    await updateConversation('c1', { pinned: true })

    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('PATCH')
    expect(String(init?.body)).toContain('"pinned":true')
  })
})

describe('deleteConversation', () => {
  it('DELETE tra 204', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
      ok: true,
      status: 204,
      text: async () => '',
    }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteConversation('c1')

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })

  it('nem ApiError khi server tra loi', async () => {
    stubError(404, 'NOT_FOUND', 'Khong tim thay cuoc tro chuyen')

    await expect(deleteConversation('c1')).rejects.toBeInstanceOf(ApiError)
  })
})

describe('getConversationMessages', () => {
  it('GET dung duong dan messages', async () => {
    const fetchMock = stubOk({ conversation: { id: 'c1' }, messages: [] })

    await getConversationMessages('c1')

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/conversations/c1/messages')
  })
})
