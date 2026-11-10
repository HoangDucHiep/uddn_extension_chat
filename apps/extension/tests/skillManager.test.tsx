import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const exportSkillsFileMock = vi.fn()
const importSkillsFileMock = vi.fn()

vi.mock('@/lib/skillIO', () => ({
  exportSkillsFile: (skills: unknown) => exportSkillsFileMock(skills),
  importSkillsFile: (file: unknown) => importSkillsFileMock(file),
}))

const { SkillManager } = await import('../src/sidepanel/components/skills/SkillManager')
const { useSkillStore } = await import('../src/sidepanel/store/skillStore')

/**
 * Unit test cho drawer quan ly skill (T-M2-04 — FR-SKILL-02/03).
 *
 * Kiem chung: 2 nhom built-in / user · tao · sua · nhan ban · xoa (co confirm)
 * · built-in KHONG cho sua/xoa.
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
    scope: 'builtin',
    enabled: true,
    tags: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

const BUILTIN = skill({ id: 's1', name: 'tom-tat', scope: 'builtin' })
const USER = skill({ id: 's2', name: 'skill-cua-toi', scope: 'user' })

beforeEach(() => {
  vi.clearAllMocks()
  listSkillsMock.mockResolvedValue([BUILTIN, USER])
  useSkillStore.setState({ items: [], isLoading: false, error: undefined })
})

describe('SkillManager', () => {
  it('nap danh sach skill khi mo drawer', async () => {
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(listSkillsMock).toHaveBeenCalled()
    })
  })

  it('hien thi 2 nhom: co san + cua toi', async () => {
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })
    expect(screen.getByText('Có sẵn')).toBeTruthy()
    expect(screen.getByText('Của tôi')).toBeTruthy()
  })

  it('bam "Dung" skill → goi onUse voi skill tuong ung', async () => {
    const onUse = vi.fn()
    render(<SkillManager onUse={onUse} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    fireEvent.click(screen.getAllByTestId('skill-use')[1] as HTMLElement)

    expect(onUse).toHaveBeenCalledTimes(1)
    expect((onUse.mock.calls[0]?.[0] as Skill).name).toBe('skill-cua-toi')
  })

  it('built-in KHONG co nut sua / xoa', async () => {
    render(<SkillManager onUse={vi.fn()} onEdit={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    // Chi 1 nut xoa (cho skill user) + 1 nut sua.
    expect(screen.getAllByTestId('skill-delete')).toHaveLength(1)
    expect(screen.getAllByTestId('skill-edit')).toHaveLength(1)
  })

  it('bam nut sua skill user → goi onEdit', async () => {
    const onEdit = vi.fn()
    render(<SkillManager onUse={vi.fn()} onEdit={onEdit} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-edit')).toHaveLength(1)
    })

    fireEvent.click(screen.getByTestId('skill-edit'))

    expect(onEdit).toHaveBeenCalledTimes(1)
    expect((onEdit.mock.calls[0]?.[0] as Skill).name).toBe('skill-cua-toi')
  })

  it('bam nut nhan ban → tao ban sao voi ten `-copy`', async () => {
    createSkillMock.mockResolvedValue(skill({ id: 's3', name: 'skill-cua-toi-copy' }))
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-duplicate')).toHaveLength(1)
    })

    fireEvent.click(screen.getByTestId('skill-duplicate'))

    await waitFor(() => {
      expect(createSkillMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'skill-cua-toi-copy' }),
      )
    })
  })

  it('bam nut xoa → hien confirm dialog; xac nhan moi goi API', async () => {
    deleteSkillMock.mockResolvedValue(undefined)
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-delete')).toHaveLength(1)
    })

    fireEvent.click(screen.getByTestId('skill-delete'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeTruthy()
    })
    expect(deleteSkillMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('confirm-accept'))

    await waitFor(() => {
      expect(deleteSkillMock).toHaveBeenCalledWith('s2')
    })
  })

  it('hien nut "Tao ky nang" khi truyen onCreate', async () => {
    const onCreate = vi.fn()
    render(<SkillManager onUse={vi.fn()} onCreate={onCreate} />)

    fireEvent.click(screen.getByTestId('skill-new'))

    expect(onCreate).toHaveBeenCalled()
  })

  it('khong hien nut "Tao ky nang" khi khong truyen onCreate', () => {
    render(<SkillManager onUse={vi.fn()} />)

    expect(screen.queryByTestId('skill-new')).toBeNull()
  })

  it('hien loi khi nap danh sach that bai', async () => {
    listSkillsMock.mockRejectedValue(new Error('BFF down'))

    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId('skill-error').textContent).toBe('BFF down')
    })
  })

  // --- FR-SKILL-05: import/export JSON (T-M2-05) ---

  it('bam "Xuat JSON" → goi exportSkillsFile', async () => {
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    fireEvent.click(screen.getByTestId('skill-export'))

    expect(exportSkillsFileMock).toHaveBeenCalledTimes(1)
  })

  it('nut xuat bi disable khi khong co skill cua user', async () => {
    listSkillsMock.mockResolvedValue([BUILTIN])

    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(1)
    })

    expect((screen.getByTestId('skill-export') as HTMLButtonElement).disabled).toBe(true)
  })

  it('chon file → goi importSkillsFile', async () => {
    importSkillsFileMock.mockResolvedValue([])

    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    const file = new File(['{}'], 'skills.json', { type: 'application/json' })
    fireEvent.change(screen.getByTestId('skill-import-input'), { target: { files: [file] } })

    await waitFor(() => {
      expect(importSkillsFileMock).toHaveBeenCalledTimes(1)
    })
  })

  it('import skill trung ten → bo qua (khong goi tao skill)', async () => {
    importSkillsFileMock.mockResolvedValue([
      { name: 'skill-cua-toi', description: '', promptTemplate: 'x', tags: [] },
    ])

    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    const file = new File(['{}'], 'skills.json', { type: 'application/json' })
    fireEvent.change(screen.getByTestId('skill-import-input'), { target: { files: [file] } })

    await waitFor(() => {
      expect(importSkillsFileMock).toHaveBeenCalled()
    })
    expect(createSkillMock).not.toHaveBeenCalled()
  })

  it('import skill moi → goi tao skill', async () => {
    importSkillsFileMock.mockResolvedValue([
      { name: 'skill-moi', description: '', promptTemplate: 'x', tags: [] },
    ])
    createSkillMock.mockResolvedValue(skill({ id: 's9', name: 'skill-moi', scope: 'user' }))

    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    const file = new File(['{}'], 'skills.json', { type: 'application/json' })
    fireEvent.change(screen.getByTestId('skill-import-input'), { target: { files: [file] } })

    await waitFor(() => {
      expect(createSkillMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'skill-moi' }),
      )
    })
  })

  // --- FR-SKILL-07: tab "Thu vien" (T-M2-06) ---

  it('mac dinh hien tab "Quan ly", an tab "Thu vien"', async () => {
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    expect(screen.queryByTestId('skill-library')).toBeNull()
    expect(screen.getByTestId('skill-tab-manage').getAttribute('aria-selected')).toBe('true')
  })

  it('bam tab "Thu vien" → hien SkillLibrary', async () => {
    render(<SkillManager onUse={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-use')).toHaveLength(2)
    })

    fireEvent.click(screen.getByTestId('skill-tab-library'))

    expect(screen.getByTestId('skill-library')).toBeTruthy()
    expect(screen.getByTestId('skill-tab-library').getAttribute('aria-selected')).toBe('true')
  })
})
