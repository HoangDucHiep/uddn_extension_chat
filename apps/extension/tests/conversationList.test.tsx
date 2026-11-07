import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ConversationSummary } from '@sidekick/shared'

const listConversationsMock = vi.fn()

vi.mock('@/lib/conversationClient', () => ({
  listConversations: (params: unknown) => listConversationsMock(params),
  createConversation: vi.fn(async () => ({
    id: 'c-new',
    title: 'Cuộc trò chuyện mới',
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
  })),
  updateConversation: vi.fn(async (id: string, patch: { title?: string; pinned?: boolean }) => ({
    id,
    title: patch.title ?? 'Moi',
    pinned: patch.pinned ?? false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messageCount: 0,
  })),
  deleteConversation: vi.fn(async () => undefined),
}))

const { ConversationList } = await import(
  '../src/sidepanel/components/chat/ConversationList'
)
const { useConversationStore } = await import('../src/sidepanel/store/conversationStore')

/**
 * Unit test cho drawer danh sach cuoc tro chuyen (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

/** Danh sach conversation ma API gia lap se tra ve. */
let mockItems: ConversationSummary[] = []

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

/** Nap state cua store + dong bo API gia lap. */
function seed(items: ConversationSummary[], extra: Record<string, unknown> = {}): void {
  mockItems = items
  useConversationStore.setState({
    items,
    isLoading: false,
    error: undefined,
    query: '',
    archivedView: false,
    nextCursor: undefined,
    activeConversationId: undefined,
    ...extra,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockItems = []
  listConversationsMock.mockImplementation(async () => ({ items: mockItems }))
  seed([])
})

describe('ConversationList', () => {
  it('render danh sach conversation', async () => {
    seed([summary({ id: 'c1', title: 'Bài viết A' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    expect(await screen.findByText('Bài viết A')).toBeTruthy()
  })

  it('hien thi loi khi API that bai', async () => {
    listConversationsMock.mockRejectedValue(new Error('BFF down'))

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    expect((await screen.findByTestId('conversation-error')).textContent).toBe('BFF down')
  })

  it('goi onSelect khi bam 1 conversation', async () => {
    seed([summary({ id: 'c1', title: 'Chat 1' })])
    const onSelect = vi.fn()

    render(<ConversationList onSelect={onSelect} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-item'))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('goi onCreate khi tao chat moi', async () => {
    const onCreate = vi.fn()

    render(<ConversationList onSelect={vi.fn()} onCreate={onCreate} />)

    fireEvent.click(await screen.findByTestId('conversation-new'))
    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith('c-new')
    })
  })

  it('bam nut ghim → ghim conversation', async () => {
    seed([summary({ id: 'c1' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-pin'))
    await waitFor(() => {
      expect(useConversationStore.getState().items[0]?.pinned).toBe(true)
    })
  })

  it('bam nut xoa → mo confirm dialog', async () => {
    seed([summary({ id: 'c1', title: 'Can xoa' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-delete'))
    expect(await screen.findByTestId('confirm-dialog')).toBeTruthy()
  })

  it('xac nhan xoa → conversation bi xoa khoi danh sach', async () => {
    seed([summary({ id: 'c1' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-delete'))
    fireEvent.click(await screen.findByTestId('confirm-accept'))

    await waitFor(() => {
      expect(useConversationStore.getState().items).toHaveLength(0)
    })
  })

  it('huy xoa → conversation van con', async () => {
    seed([summary({ id: 'c1' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-delete'))
    fireEvent.click(await screen.findByTestId('confirm-cancel'))

    await waitFor(() => {
      expect(useConversationStore.getState().items).toHaveLength(1)
    })
  })

  it('bam nut doi ten → hien thi input sua ten', async () => {
    seed([summary({ id: 'c1', title: 'Cu' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-rename'))
    expect(await screen.findByTestId('conversation-rename-input')).toBeTruthy()
  })

  it('nhan Enter de luu ten moi', async () => {
    seed([summary({ id: 'c1', title: 'Cu' })])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-rename'))
    const input = await screen.findByTestId('conversation-rename-input')
    fireEvent.change(input, { target: { value: 'Moi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(useConversationStore.getState().items[0]?.title).toBe('Moi')
    })
  })

  it('chuyen sang tab da luu tru → setArchivedView(true)', async () => {
    const spy = vi.spyOn(useConversationStore.getState(), 'setArchivedView')

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    fireEvent.click(await screen.findByTestId('conversation-tab-archived'))
    expect(spy).toHaveBeenCalledWith(true)
  })

  it('gom conversation ghim vao nhom "Da ghim"', async () => {
    seed([
      summary({ id: 'c1', title: 'Ghim', pinned: true }),
      summary({ id: 'c2', title: 'Khong ghim' }),
    ])

    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    expect(await screen.findByText('Đã ghim')).toBeTruthy()
    expect(screen.getByText('Gần đây')).toBeTruthy()
  })

  it('nap danh sach khi mount', async () => {
    render(<ConversationList onSelect={vi.fn()} onCreate={vi.fn()} />)

    await waitFor(() => {
      expect(listConversationsMock).toHaveBeenCalled()
    })
  })
})
