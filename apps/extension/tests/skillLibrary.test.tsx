import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Skill } from '@sidekick/shared'

const listSkillsMock = vi.fn()

vi.mock('@/lib/skillClient', () => ({
  listSkills: (params?: unknown) => listSkillsMock(params),
}))

const { SkillLibrary } = await import('../src/sidepanel/components/skills/SkillLibrary')

/**
 * Unit test cho thu vien skill (T-M2-06 — FR-SKILL-07).
 *
 * Kiem chung: loc theo tag · tim kiem · click skill → goi `onUse`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25.9
 */

/** Tao skill gia lap. */
function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'builtin',
    enabled: true,
    tags: ['summary'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const SKILLS = [
  skill({ id: 's1', name: 'tom-tat', tags: ['summary'] }),
  skill({ id: 's2', name: 'viet-email', description: 'Soan email', tags: ['email'] }),
  skill({ id: 's3', name: 'dich', scope: 'user', tags: ['translate'] }),
]

beforeEach(() => {
  vi.clearAllMocks()
  listSkillsMock.mockResolvedValue(SKILLS)
})

describe('SkillLibrary', () => {
  it('nap danh sach skill khi mo', async () => {
    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-library-item')).toHaveLength(3)
    })
  })

  it('hien chip tag suy ra tu thu vien', async () => {
    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-library-tag').length).toBeGreaterThan(0)
    })
    const tags = screen.getAllByTestId('skill-library-tag').map((node) => node.getAttribute('data-tag'))
    expect(tags).toContain('summary')
    expect(tags).toContain('email')
  })

  it('bam chip tag → goi API voi tags', async () => {
    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-library-tag').length).toBeGreaterThan(0)
    })

    const chip = screen
      .getAllByTestId('skill-library-tag')
      .find((node) => node.getAttribute('data-tag') === 'email')
    fireEvent.click(chip as HTMLElement)

    await waitFor(() => {
      expect(listSkillsMock).toHaveBeenCalledWith(expect.objectContaining({ tags: ['email'] }))
    })
  })

  it('goi API voi q khi go tim kiem', async () => {
    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-library-item')).toHaveLength(3)
    })

    fireEvent.change(screen.getByTestId('skill-library-search'), {
      target: { value: 'email' },
    })

    await waitFor(() => {
      expect(listSkillsMock).toHaveBeenCalledWith(expect.objectContaining({ q: 'email' }))
    })
  })

  it('click skill → goi onUse voi skill do', async () => {
    const onUse = vi.fn()
    render(<SkillLibrary onUse={onUse} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-library-item')).toHaveLength(3)
    })

    const item = screen
      .getAllByTestId('skill-library-item')
      .find((node) => node.getAttribute('data-skill-name') === 'viet-email')
    fireEvent.click(item as HTMLElement)

    expect(onUse).toHaveBeenCalledTimes(1)
    expect((onUse.mock.calls[0]?.[0] as Skill).name).toBe('viet-email')
  })

  it('khong co ket qua → hien thong bao rong', async () => {
    listSkillsMock.mockResolvedValue([])

    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('skill-library-empty')).toBeTruthy()
    })
  })

  it('API that bai → hien loi', async () => {
    listSkillsMock.mockRejectedValue(new Error('BFF down'))

    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('skill-library-error').textContent).toBe('BFF down')
    })
  })

  it('hien badge pham vi', async () => {
    render(<SkillLibrary onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-library-scope').length).toBeGreaterThan(0)
    })
    const scopes = screen.getAllByTestId('skill-library-scope').map((node) => node.textContent)
    expect(scopes).toContain('Có sẵn')
    expect(scopes).toContain('Của tôi')
  })
})
