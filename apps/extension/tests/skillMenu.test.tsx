import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Skill } from '@sidekick/shared'

const { SkillMenu } = await import('../src/sidepanel/components/skills/SkillMenu')

/**
 * Unit test cho popover menu `/` (T-M2-04 — FR-SKILL-01).
 *
 * Kiem chung: loc theo prefix · dong active · chon skill.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Tao skill gia lap. */
function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt nội dung',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'builtin',
    enabled: true,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

const SKILLS: Skill[] = [
  skill({ id: 's1', name: 'tom-tat', scope: 'builtin' }),
  skill({ id: 's2', name: 'tom-tieu', scope: 'user' }),
  skill({ id: 's3', name: 'dich', scope: 'builtin' }),
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SkillMenu', () => {
  it('hien thi tat ca skill khi query rong', () => {
    render(<SkillMenu skills={SKILLS} query="" activeIndex={0} onSelect={vi.fn()} />)

    expect(screen.getAllByTestId('skill-option')).toHaveLength(3)
  })

  it('loc theo prefix', () => {
    render(<SkillMenu skills={SKILLS} query="tom" activeIndex={0} onSelect={vi.fn()} />)

    const options = screen.getAllByTestId('skill-option')
    expect(options).toHaveLength(2)
    expect(options[0]?.getAttribute('data-skill-name')).toBe('tom-tat')
  })

  it('khong co skill khop → hien thi thong bao rong', () => {
    render(<SkillMenu skills={SKILLS} query="zzz" activeIndex={0} onSelect={vi.fn()} />)

    expect(screen.queryAllByTestId('skill-option')).toHaveLength(0)
    expect(screen.getByTestId('skill-popover')).toBeTruthy()
  })

  it('danh dau dong active', () => {
    render(<SkillMenu skills={SKILLS} query="" activeIndex={1} onSelect={vi.fn()} />)

    const options = screen.getAllByTestId('skill-option')
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
  })

  it('bam vao 1 dong → goi onSelect voi skill tuong ung', () => {
    const onSelect = vi.fn()
    render(<SkillMenu skills={SKILLS} query="" activeIndex={0} onSelect={onSelect} />)

    fireEvent.click(screen.getAllByTestId('skill-option')[2] as HTMLElement)

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect((onSelect.mock.calls[0]?.[0] as Skill).name).toBe('dich')
  })

  it('co badge pham vi cho skill built-in va user', () => {
    render(<SkillMenu skills={SKILLS} query="" activeIndex={0} onSelect={vi.fn()} />)

    const badges = screen.getAllByTestId('skill-scope')
    expect(badges).toHaveLength(3)
    expect(badges[0]?.textContent).toContain('Có sẵn')
    expect(badges[1]?.textContent).toContain('Của tôi')
  })
})
