import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, type ChatMessage } from '../src/sidepanel/store/chatStore'

/**
 * Unit test cho Zustand store cua side panel.
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §7 (state)
 */

const userMessage: ChatMessage = {
  id: 'user-1',
  role: 'user',
  content: 'Xin chao',
  createdAt: 1_700_000_000_000,
  status: 'done',
}

beforeEach(() => {
  useChatStore.getState().reset()
})

describe('useChatStore', () => {
  it('bat dau voi state rong', () => {
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.conversationId).toBeUndefined()
  })

  it('addMessage them message vao cuoi', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().addMessage({ ...userMessage, id: 'assistant-1', role: 'assistant' })
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual(['user-1', 'assistant-1'])
  })

  it('appendToMessage noi noi dung vao message dung id', () => {
    useChatStore.getState().addMessage({ ...userMessage, id: 'a1', role: 'assistant', content: '' })
    useChatStore.getState().appendToMessage('a1', 'Xin')
    useChatStore.getState().appendToMessage('a1', ' chao')
    const message = useChatStore.getState().messages[0]
    expect(message?.content).toBe('Xin chao')
  })

  it('appendToMessage khong tao message moi khi id khong ton tai', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().appendToMessage('khong-ton-tai', 'abc')
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0]?.content).toBe('Xin chao')
  })

  it('updateMessage patch cac truong', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().updateMessage('user-1', { status: 'error', errorMessage: 'Loi' })
    const message = useChatStore.getState().messages[0]
    expect(message?.status).toBe('error')
    expect(message?.errorMessage).toBe('Loi')
  })

  it('setActive luu provider/model/keySource', () => {
    useChatStore.getState().setActive({ provider: 'groq', model: 'gpt-oss', keySource: 'K1' })
    const state = useChatStore.getState()
    expect(state.activeProvider).toBe('groq')
    expect(state.activeModel).toBe('gpt-oss')
    expect(state.keySource).toBe('K1')
  })

  it('setActive voi gia tri undefined xoa thong tin cu', () => {
    useChatStore.getState().setActive({ provider: 'groq' })
    useChatStore.getState().setActive({ provider: undefined })
    expect(useChatStore.getState().activeProvider).toBeUndefined()
  })

  it('reset xoa toan bo state', () => {
    useChatStore.getState().addMessage(userMessage)
    useChatStore.getState().setConversationId('conv-1')
    useChatStore.getState().setStreaming(true)
    useChatStore.getState().reset()

    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.conversationId).toBeUndefined()
    expect(state.isStreaming).toBe(false)
  })
})

describe('useChatStore — context (FR-CONTEXT-07)', () => {
  it('mac dinh khong gui context (contextEnabled = false)', () => {
    expect(useChatStore.getState().contextEnabled).toBe(false)
    expect(useChatStore.getState().attachedItems).toEqual([])
    expect(useChatStore.getState().budget).toBeUndefined()
  })

  it('attachItem them item va bat context', () => {
    useChatStore.getState().attachItem({
      id: 'tab-1',
      kind: 'tab',
      tier: 'attachment',
      title: 'Bai viet',
      url: 'https://example.com',
      text: 'Noi dung',
    })

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(1)
    expect(state.attachedItems[0]?.id).toBe('tab-1')
    // Dinh kem = user chu dong muon dung context → context bat.
    expect(state.contextEnabled).toBe(true)
  })

  it('attachItem voi cung id thi thay the (khong trung)', () => {
    const item = {
      id: 'tab-1',
      kind: 'tab' as const,
      tier: 'attachment' as const,
      title: 'Bai viet',
    }
    useChatStore.getState().attachItem(item)
    useChatStore.getState().attachItem({ ...item, title: 'Bai viet (cap nhat)' })

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(1)
    expect(state.attachedItems[0]?.title).toBe('Bai viet (cap nhat)')
  })

  it('removeItem xoa item theo id', () => {
    useChatStore.getState().attachItem({
      id: 'tab-1',
      kind: 'tab',
      tier: 'attachment',
      title: 'A',
    })
    useChatStore.getState().attachItem({
      id: 'tab-2',
      kind: 'tab',
      tier: 'attachment',
      title: 'B',
    })
    useChatStore.getState().removeItem('tab-1')

    const state = useChatStore.getState()
    expect(state.attachedItems.map((item) => item.id)).toEqual(['tab-2'])
  })

  it('clearAttachedItems xoa sach item + budget', () => {
    useChatStore.getState().attachItem({
      id: 'tab-1',
      kind: 'tab',
      tier: 'attachment',
      title: 'A',
      text: 'x'.repeat(400),
    })
    expect(useChatStore.getState().budget).toBeDefined()

    useChatStore.getState().clearAttachedItems()

    const state = useChatStore.getState()
    expect(state.attachedItems).toEqual([])
    expect(state.budget).toBeUndefined()
  })

  it('setContextEnabled doi trang thai', () => {
    useChatStore.getState().setContextEnabled(true)
    expect(useChatStore.getState().contextEnabled).toBe(true)
    useChatStore.getState().setContextEnabled(false)
    expect(useChatStore.getState().contextEnabled).toBe(false)
  })

  it('recomputeBudget tinh ngan sach cho item da dinh kem', () => {
    useChatStore.getState().attachItem({
      id: 'tab-1',
      kind: 'tab',
      tier: 'attachment',
      title: 'A',
      text: 'x'.repeat(400),
    })

    const budget = useChatStore.getState().budget
    expect(budget).toBeDefined()
    expect(budget?.usedTokens).toBeGreaterThan(0)
    expect(budget?.maxTokens).toBeGreaterThan(0)
  })

  it('reset giu nguyen context da dinh kem', () => {
    useChatStore.getState().attachItem({
      id: 'tab-1',
      kind: 'tab',
      tier: 'attachment',
      title: 'A',
    })
    useChatStore.getState().reset()

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(1)
    expect(state.contextEnabled).toBe(true)
    expect(state.messages).toEqual([])
  })
})

/**
 * Selection context (T-M1-02, FR-CONTEXT-04).
 *
 * Doan text user boi den co `tier: 'selection'` — tier CAO NHAT → phai
 * dung dau trong thu tu uu tien cat bot, va chi dung khi user dinh kem.
 */
describe('useChatStore — selection context (T-M1-02)', () => {
  /**
   * Reset store cho ve trang thai ban dau.
   *
   * `reset()` **giu nguyen** `attachedItems` + `contextEnabled` (theo design
   * cua store) → phai clear them truoc moi test.
   */
  beforeEach(() => {
    useChatStore.getState().clearAttachedItems()
    useChatStore.getState().setContextEnabled(false)
  })

  /** Item selection hop le. */
  const selectionItem = {
    id: 'selection-abc123',
    kind: 'selection' as const,
    tier: 'selection' as const,
    title: 'Doan da boi den',
    text: 'Doan van ban da boi den tren trang web de gui sang Sidekick AI.',
    excerpt: 'Doan van ban da boi den tren trang web de gui sang Sidekick AI.',
    url: 'https://example.com/bai-viet',
  }

  it('dinh kem item selection → contextEnabled tu bat', () => {
    expect(useChatStore.getState().contextEnabled).toBe(false)

    useChatStore.getState().attachItem(selectionItem)

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(1)
    expect(state.attachedItems[0]?.kind).toBe('selection')
    expect(state.attachedItems[0]?.tier).toBe('selection')
    // Dinh kem = user chu dong muon dung context → context bat.
    expect(state.contextEnabled).toBe(true)
  })

  it('dinh kem item selection → budget duoc tinh lai', () => {
    useChatStore.getState().attachItem(selectionItem)

    const state = useChatStore.getState()
    expect(state.budget).toBeDefined()
    expect(state.budget?.items).toHaveLength(1)
    expect(state.budget?.items[0]?.tier).toBe('selection')
    // Token uoc luong > 0 (chuoi text > 0 ky tu).
    expect(state.budget?.usedTokens).toBeGreaterThan(0)
  })

  it('bam lai cung doan selection → thay item, khong nhan ban', () => {
    useChatStore.getState().attachItem(selectionItem)
    useChatStore.getState().attachItem({ ...selectionItem, excerpt: 'Doan cap nhat' })

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(1)
    expect(state.attachedItems[0]?.excerpt).toBe('Doan cap nhat')
  })

  it('selection co tier CAO NHAT → dung dau trong thu tu uu tien', () => {
    useChatStore.getState().attachItem({
      id: 'tab-1',
      kind: 'tab',
      tier: 'attachment',
      title: 'Bai viet',
      text: 'Noi dung tab',
    })
    useChatStore.getState().attachItem(selectionItem)

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(2)
    // `budget.items` duoc sap xep theo `CONTEXT_TIER_ORDER` → selection dung dau.
    expect(state.budget?.items).toHaveLength(2)
    expect(state.budget?.items[0]?.tier).toBe('selection')
    expect(state.budget?.items[1]?.tier).toBe('attachment')
  })

  it('removeItem xoa item selection theo id', () => {
    useChatStore.getState().attachItem(selectionItem)
    useChatStore.getState().removeItem(selectionItem.id)

    const state = useChatStore.getState()
    expect(state.attachedItems).toHaveLength(0)
    expect(state.budget).toBeUndefined()
  })
})
