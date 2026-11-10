import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSkill,
  deleteSkill,
  listSkills,
  updateSkill,
} from '../src/lib/skillClient.js'
import type { Skill } from '@sidekick/shared'

/**
 * Unit test cho client CRUD skill (T-M2-04 — FR-SKILL-01/02/03).
 *
 * Kiem chung: parse response bang Zod schema → response sai shape → throw.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Tao skill hop le. */
function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'builtin',
    enabled: true,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

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

describe('listSkills', () => {
  it('goi GET /api/skills va tra ve items', async () => {
    const fetchMock = stubFetch({ items: [makeSkill()] })

    const items = await listSkills()

    expect(items).toHaveLength(1)
    expect(items[0]?.name).toBe('tom-tat')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/skills')
    expect(call[1].method).toBeUndefined()
  })

  it('them query scope + q khi co', async () => {
    const fetchMock = stubFetch({ items: [] })

    await listSkills({ scope: 'user', q: 'tom' })

    const call = fetchMock.mock.calls[0] as unknown as [string]
    expect(call[0]).toContain('scope=user')
    expect(call[0]).toContain('q=tom')
  })

  it('khong them query rong', async () => {
    const fetchMock = stubFetch({ items: [] })

    await listSkills({ q: '' })

    const call = fetchMock.mock.calls[0] as unknown as [string]
    expect(call[0]).not.toContain('q=')
  })

  it('response sai shape → throw', async () => {
    stubFetch({ items: [{ id: 'khong-phai-uuid' }] })

    await expect(listSkills()).rejects.toThrow()
  })
})

describe('createSkill', () => {
  it('goi POST va tra ve skill da tao', async () => {
    const fetchMock = stubFetch(makeSkill({ scope: 'user', name: 'skill-moi' }))

    const created = await createSkill({
      name: 'skill-moi',
      description: 'mo ta',
      promptTemplate: 'Prompt',
      tags: [],
    })

    expect(created.name).toBe('skill-moi')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[1].method).toBe('POST')
    expect(call[1].body).toContain('skill-moi')
  })

  it('response sai shape → throw', async () => {
    stubFetch({ id: 'x', name: 'khong-dung-schema' })

    await expect(
      createSkill({ name: 'a', description: '', promptTemplate: 'p', tags: [] }),
    ).rejects.toThrow()
  })
})

describe('updateSkill', () => {
  it('goi PATCH /api/skills/:id', async () => {
    const fetchMock = stubFetch(makeSkill({ name: 'ten-moi' }))

    const updated = await updateSkill('a1000000-0000-4000-8000-000000000001', {
      name: 'ten-moi',
    })

    expect(updated.name).toBe('ten-moi')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/skills/a1000000-0000-4000-8000-000000000001')
    expect(call[1].method).toBe('PATCH')
  })
})

describe('deleteSkill', () => {
  it('goi DELETE /api/skills/:id', async () => {
    const fetchMock = stubFetch(null)

    await deleteSkill('a1000000-0000-4000-8000-000000000001')

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toContain('/api/skills/a1000000-0000-4000-8000-000000000001')
    expect(call[1].method).toBe('DELETE')
  })

  it('BFF tra loi → throw', async () => {
    stubFetch({ error: { code: 'NOT_FOUND', message: 'Khong tim thay' } }, false, 404)

    await expect(deleteSkill('a1000000-0000-4000-8000-000000000009')).rejects.toThrow(
      'Khong tim thay',
    )
  })
})
