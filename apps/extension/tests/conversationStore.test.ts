import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ConversationSummary } from '@sidekick/shared'

const listConversationsMock = vi.fn()
const createConversationMock = vi.fn()
const updateConversationMock = vi.fn()
const deleteConversationMock = vi.fn()

vi.mock('@/lib/conversationClient', () => ({
  listConversations: (params: unknown) => listConversationsMock(params),
  createConversation: (title?: string) => createConversationMock(title),
  updateConversation: (id: string, patch: unknown) => updateConversationMock(id, patch),
  deleteConversation: (id: string) => deleteConversationMock(id),
}))

const { useConversationStore } = await import('../src/sidepanel/store/conversationStore')

/**
 * Unit test cho store danh sach cuoc tro chuyen (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

/** Tao summary gia lap. */
function summary(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: 'c1',
    title: 'Chat 1',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  listConversationsMock.mockResolvedValue({ items: [] })
  useConversationStore.setState({
    items: [],
    isLoading: false,
    error: undefined,
    query: '',
    archivedView: false,
    nextCursor: undefined,
    activeConversationId: undefined,
  })
})

describe('useConversationStore — refresh', () => {
  it('nap danh sach tu BFF', async () => {
    listConversationsMock.mockResolvedValue({ items: [summary()] })

    await useConversationStore.getState().refresh()

    expect(useConversationStore.getState().items).toHaveLength(1)
    expect(useConversationStore.getState().isLoading).toBe(false)
  })

  it('luu loi khi API that bai', async () => {
    listConversationsMock.mockRejectedValue(new Error('BFF down'))

    await useConversationStore.getState().refresh()

    expect(useConversationStore.getState().error).toBe('BFF down')
    expect(useConversationStore.getState().isLoading).toBe(false)
  })

  it('gui query khi co', async () => {
    useConversationStore.getState().setQuery('abc')

    await useConversationStore.getState().refresh()

    expect(listConversationsMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'abc' }),
    )
  })
})

describe('useConversationStore — create', () => {
  it('them conversation vao dau danh sach', async () => {
    createConversationMock.mockResolvedValue(summary({ id: 'c-new' }))
    useConversationStore.setState({ items: [summary({ id: 'c-old' })] })

    const created = await useConversationStore.getState().create()

    expect(created.id).toBe('c-new')
    expect(useConversationStore.getState().items[0]?.id).toBe('c-new')
    expect(useConversationStore.getState().activeConversationId).toBe('c-new')
  })
})

describe('useConversationStore — rename', () => {
  it('cap nhat tieu de ngay (optimistic)', async () => {
    updateConversationMock.mockResolvedValue(summary({ id: 'c1', title: 'Moi' }))
    useConversationStore.setState({ items: [summary({ id: 'c1', title: 'Cu' })] })

    await useConversationStore.getState().rename('c1', 'Moi')

    expect(useConversationStore.getState().items[0]?.title).toBe('Moi')
  })

  it('rollback khi API that bai', async () => {
    updateConversationMock.mockRejectedValue(new Error('Loi'))
    useConversationStore.setState({ items: [summary({ id: 'c1', title: 'Cu' })] })

    await expect(useConversationStore.getState().rename('c1', 'Moi')).rejects.toThrow('Loi')

    expect(useConversationStore.getState().items[0]?.title).toBe('Cu')
    expect(useConversationStore.getState().error).toBe('Loi')
  })
})

describe('useConversationStore — togglePin', () => {
  it('bat ghim ngay (optimistic)', async () => {
    updateConversationMock.mockResolvedValue(summary({ id: 'c1', pinned: true }))
    useConversationStore.setState({ items: [summary({ id: 'c1', pinned: false })] })

    await useConversationStore.getState().togglePin('c1')

    expect(useConversationStore.getState().items[0]?.pinned).toBe(true)
    expect(updateConversationMock).toHaveBeenCalledWith('c1', { pinned: true })
  })

  it('rollback khi API that bai', async () => {
    updateConversationMock.mockRejectedValue(new Error('Loi'))
    useConversationStore.setState({ items: [summary({ id: 'c1', pinned: false })] })

    await expect(useConversationStore.getState().togglePin('c1')).rejects.toThrow('Loi')

    expect(useConversationStore.getState().items[0]?.pinned).toBe(false)
  })
})

describe('useConversationStore — toggleArchive', () => {
  it('bat luu tru ngay (optimistic)', async () => {
    updateConversationMock.mockResolvedValue(summary({ id: 'c1', archived: true }))
    useConversationStore.setState({ items: [summary({ id: 'c1', archived: false })] })

    await useConversationStore.getState().toggleArchive('c1')

    expect(useConversationStore.getState().items[0]?.archived).toBe(true)
  })

  it('rollback khi API that bai', async () => {
    updateConversationMock.mockRejectedValue(new Error('Loi'))
    useConversationStore.setState({ items: [summary({ id: 'c1', archived: false })] })

    await expect(useConversationStore.getState().toggleArchive('c1')).rejects.toThrow('Loi')

    expect(useConversationStore.getState().items[0]?.archived).toBe(false)
  })
})

describe('useConversationStore — remove', () => {
  it('xoa conversation khoi danh sach', async () => {
    deleteConversationMock.mockResolvedValue(undefined)
    useConversationStore.setState({
      items: [summary({ id: 'c1' }), summary({ id: 'c2' })],
      activeConversationId: 'c1',
    })

    await useConversationStore.getState().remove('c1')

    expect(useConversationStore.getState().items).toHaveLength(1)
    expect(useConversationStore.getState().activeConversationId).toBeUndefined()
  })

  it('rollback khi API that bai', async () => {
    deleteConversationMock.mockRejectedValue(new Error('Loi'))
    useConversationStore.setState({ items: [summary({ id: 'c1' })] })

    await expect(useConversationStore.getState().remove('c1')).rejects.toThrow('Loi')

    expect(useConversationStore.getState().items).toHaveLength(1)
  })
})

describe('useConversationStore — loadMore', () => {
  it('ghep them trang moi vao danh sach', async () => {
    useConversationStore.setState({
      items: [summary({ id: 'c1' })],
      nextCursor: 'cursor-1',
    })
    listConversationsMock.mockResolvedValue({ items: [summary({ id: 'c2' })] })

    await useConversationStore.getState().loadMore()

    expect(useConversationStore.getState().items.map((item) => item.id)).toEqual(['c1', 'c2'])
  })

  it('khong goi API khi khong con cursor', async () => {
    await useConversationStore.getState().loadMore()

    expect(listConversationsMock).not.toHaveBeenCalled()
  })

  it('khong them trung id', async () => {
    useConversationStore.setState({
      items: [summary({ id: 'c1' })],
      nextCursor: 'cursor-1',
    })
    listConversationsMock.mockResolvedValue({ items: [summary({ id: 'c1' })] })

    await useConversationStore.getState().loadMore()

    expect(useConversationStore.getState().items).toHaveLength(1)
  })
})
