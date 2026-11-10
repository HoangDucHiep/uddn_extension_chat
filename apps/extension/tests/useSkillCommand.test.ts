import { describe, expect, it } from 'vitest'
import { findSkillToken } from '../src/sidepanel/hooks/useSkillCommand.js'
import type { Skill } from '@sidekick/shared'

/**
 * Unit test cho logic phat hien token `/` (T-M2-04 — FR-SKILL-01).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Tao skill gia lap. */
function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: '',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'user',
    enabled: true,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('findSkillToken', () => {
  it('bat token `/` o dau chuoi', () => {
    const match = findSkillToken('/tom', 4)

    expect(match).toBeDefined()
    expect(match?.query).toBe('tom')
    expect(match?.start).toBe(0)
    expect(match?.end).toBe(4)
  })

  it('bat token `/` sau khoang trang', () => {
    const value = 'so sanh /tab'
    const match = findSkillToken(value, value.length)

    expect(match?.query).toBe('tab')
    expect(match?.start).toBe(8)
    expect(match?.end).toBe(12)
  })

  it('bat token `/` rong (vua go xong dau `/`)', () => {
    const match = findSkillToken('/', 1)

    expect(match?.query).toBe('')
    expect(match?.start).toBe(0)
  })

  it('KHONG bat `/` nam giua URL', () => {
    const value = 'xem https://example.com/docs'
    const match = findSkillToken(value, value.length)

    expect(match).toBeUndefined()
  })

  it('KHONG bat `/` dinh ngay sau ky tu chu hoac so', () => {
    const value = 'a/b'
    const match = findSkillToken(value, value.length)

    expect(match).toBeUndefined()
  })

  it('KHONG bat khi con tro nam truoc token `/`', () => {
    const match = findSkillToken('/abc', 0)

    expect(match).toBeUndefined()
  })

  it('KHONG bat khi khong co `/` trong phan truoc con tro', () => {
    const match = findSkillToken('xin chao', 8)

    expect(match).toBeUndefined()
  })

  it('KHONG bat khi con tro vuot do dai chuoi', () => {
    expect(findSkillToken('/abc', 99)).toBeUndefined()
  })

  it('KHONG bat khi con tro am', () => {
    expect(findSkillToken('/abc', -1)).toBeUndefined()
  })

  it('chi bat token moi nhat (nhieu `/` trong cung 1 chuoi)', () => {
    const value = '/a /b'
    const match = findSkillToken(value, value.length)

    expect(match?.query).toBe('b')
    expect(match?.start).toBe(3)
  })

  it('token khong chua khoang trang', () => {
    const value = '/tom viet'
    const match = findSkillToken(value, 4)

    expect(match?.query).toBe('tom')
  })

  it('token co dau phay cach → KHONG bat (ky tu truoc khong phai khoang trang)', () => {
    const value = 'xem:/tom'
    const match = findSkillToken(value, value.length)

    expect(match).toBeUndefined()
  })
})

describe('apply / strip', () => {
  it('apply thay token bang `/ten-skill ` va tra cursor moi', async () => {
    const { useSkillCommand } = await import('../src/sidepanel/hooks/useSkillCommand.js')
    const { renderHook } = await import('@testing-library/react')

    const { result } = renderHook(() => useSkillCommand())

    const applied = result.current.apply('/to', 3, skill({ name: 'tom-tat' }))

    expect(applied.value).toBe('/tom-tat ')
    expect(applied.cursor).toBe(9)
  })

  it('strip bo token `/ten-skill` khoi cau hoi', async () => {
    const { useSkillCommand } = await import('../src/sidepanel/hooks/useSkillCommand.js')
    const { renderHook } = await import('@testing-library/react')

    const { result } = renderHook(() => useSkillCommand())

    expect(result.current.strip('/tom-tat viet bai', 'tom-tat')).toBe('viet bai')
  })

  it('strip khong xoa duong dan URL chua ten skill', async () => {
    const { useSkillCommand } = await import('../src/sidepanel/hooks/useSkillCommand.js')
    const { renderHook } = await import('@testing-library/react')

    const { result } = renderHook(() => useSkillCommand())

    expect(result.current.strip('xem https://example.com/tom-tat', 'tom-tat')).toBe(
      'xem https://example.com/tom-tat',
    )
  })
})
