import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Skill } from '@sidekick/shared'

const listSkillsMock = vi.fn()
const createSkillMock = vi.fn()
const updateSkillMock = vi.fn()
const deleteSkillMock = vi.fn()

vi.mock('@/lib/skillClient', () => ({
  listSkills: (params?: unknown) => listSkillsMock(params),
  createSkill: (input: unknown) => createSkillMock(input),
  updateSkill: (id: string, patch: unknown) => updateSkillMock(id, patch),
  deleteSkill: (id: string) => deleteSkillMock(id),
}))

const { useSkillStore } = await import('../src/sidepanel/store/skillStore')

/**
 * Unit test cho store danh sach skill (T-M2-04 — FR-SKILL-01/02/03).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Tao skill gia lap. */
function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'tom-tat',
    description: 'Tóm tắt',
    promptTemplate: 'Tóm tắt {input}',
    scope: 'user',
    enabled: true,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listSkillsMock.mockResolvedValue([])
  useSkillStore.setState({
    items: [],
    isLoading: false,
    error: undefined,
  })
})

describe('useSkillStore — refresh', () => {
  it('nap danh sach tu BFF', async () => {
    listSkillsMock.mockResolvedValue([skill()])

    await useSkillStore.getState().refresh()

    expect(useSkillStore.getState().items).toHaveLength(1)
    expect(useSkillStore.getState().isLoading).toBe(false)
  })

  it('luu loi khi API that bai', async () => {
    listSkillsMock.mockRejectedValue(new Error('BFF down'))

    await useSkillStore.getState().refresh()

    expect(useSkillStore.getState().error).toBe('BFF down')
    expect(useSkillStore.getState().isLoading).toBe(false)
  })
})

describe('useSkillStore — create', () => {
  it('them skill vao danh sach', async () => {
    createSkillMock.mockResolvedValue(skill({ id: 'skill-new', name: 'skill-moi' }))

    const created = await useSkillStore.getState().create({
      name: 'skill-moi',
      description: '',
      promptTemplate: 'Prompt',
      tags: [],
    })

    expect(created.name).toBe('skill-moi')
    expect(useSkillStore.getState().items).toHaveLength(1)
  })
})

describe('useSkillStore — update', () => {
  it('cap nhat ngay (optimistic)', async () => {
    updateSkillMock.mockResolvedValue(skill({ name: 'ten-moi' }))
    useSkillStore.setState({ items: [skill({ name: 'ten-cu' })] })

    await useSkillStore.getState().update('a1000000-0000-4000-8000-000000000001', {
      name: 'ten-moi',
    })

    expect(useSkillStore.getState().items[0]?.name).toBe('ten-moi')
  })

  it('rollback khi API that bai', async () => {
    updateSkillMock.mockRejectedValue(new Error('Loi'))
    useSkillStore.setState({ items: [skill({ name: 'ten-cu' })] })

    await expect(
      useSkillStore.getState().update('a1000000-0000-4000-8000-000000000001', {
        name: 'ten-moi',
      }),
    ).rejects.toThrow('Loi')

    expect(useSkillStore.getState().items[0]?.name).toBe('ten-cu')
    expect(useSkillStore.getState().error).toBe('Loi')
  })

  it('xoa field `model` khi patch truyen null', async () => {
    updateSkillMock.mockResolvedValue(skill({ model: undefined }))
    useSkillStore.setState({ items: [skill({ model: 'gemini-2.5-flash' })] })

    await useSkillStore.getState().update('a1000000-0000-4000-8000-000000000001', {
      model: null,
    })

    expect(useSkillStore.getState().items[0]?.model).toBeUndefined()
  })
})

describe('useSkillStore — remove', () => {
  it('xoa skill khoi danh sach', async () => {
    deleteSkillMock.mockResolvedValue(undefined)
    useSkillStore.setState({ items: [skill({ id: 'c1' }), skill({ id: 'c2' })] })

    await useSkillStore.getState().remove('c1')

    expect(useSkillStore.getState().items).toHaveLength(1)
    expect(useSkillStore.getState().items[0]?.id).toBe('c2')
  })

  it('rollback khi API that bai', async () => {
    deleteSkillMock.mockRejectedValue(new Error('Loi'))
    useSkillStore.setState({ items: [skill({ id: 'c1' })] })

    await expect(useSkillStore.getState().remove('c1')).rejects.toThrow('Loi')

    expect(useSkillStore.getState().items).toHaveLength(1)
  })
})

describe('useSkillStore — duplicate', () => {
  it('nhan ban them `-copy` vao ten', async () => {
    createSkillMock.mockResolvedValue(skill({ id: 'c-copy', name: 'tom-tat-copy' }))
    useSkillStore.setState({ items: [skill({ id: 'c1', name: 'tom-tat' })] })

    const created = await useSkillStore.getState().duplicate('c1')

    expect(created.name).toBe('tom-tat-copy')
    expect(createSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'tom-tat-copy' }),
    )
    expect(useSkillStore.getState().items).toHaveLength(2)
  })

  it('khong tim thay skill → throw', async () => {
    await expect(useSkillStore.getState().duplicate('khong-co')).rejects.toThrow()
  })
})
