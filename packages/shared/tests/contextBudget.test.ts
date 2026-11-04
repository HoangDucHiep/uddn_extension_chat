import { describe, expect, it } from 'vitest'
import {
  applyContextBudget,
  CHARS_PER_TOKEN,
  estimateTokens,
  trimHistory,
} from '../src/contextBudget.js'
import { contextBundleSchema, type ContextItem } from '../src/schemas/chat.js'

/**
 * Test cho thu vien ngan sach context (FR-CONTEXT-07).
 * Docs: docs/SYSTEM_DESIGN.md §8
 */

function makeItem(overrides: Partial<ContextItem> & Pick<ContextItem, 'id' | 'tier'>): ContextItem {
  return {
    kind: 'tab',
    title: 'Tieu de',
    ...overrides,
  }
}

describe('estimateTokens', () => {
  it('chuoi rong → 0 token', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('uoc luong theo 4 ky tu / token', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })

  it('CHARS_PER_TOKEN la 4', () => {
    expect(CHARS_PER_TOKEN).toBe(4)
  })
})

describe('applyContextBudget', () => {
  it('khong cat item nao khi ngan sach lon', () => {
    const items = [
      makeItem({ id: 'a', tier: 'selection', text: 'doan boi den' }),
      makeItem({ id: 'b', tier: 'attachment', text: 'noi dung tab' }),
    ]

    const result = applyContextBudget(items, { contextWindow: 1_000_000, reservedOutputTokens: 0 })

    expect(result.droppedItems).toBe(0)
    expect(result.items).toHaveLength(2)
    expect(result.items.every((item) => item.truncated === false)).toBe(true)
    expect(result.usedTokens).toBe(estimateTokens('doan boi den') + estimateTokens('noi dung tab'))
    // maxTokens = contextWindow - reservedOutputTokens - safetyMargin.
    expect(result.maxTokens).toBe(1_000_000 - 0 - 2_000)
  })

  it('selection duoc giu tron khi attachment bi cat', () => {
    // Ngan sach chi chua duoc mot phan nho cua attachment.
    const items = [
      makeItem({ id: 'sel', tier: 'selection', text: 's'.repeat(40) }),
      makeItem({ id: 'att', tier: 'attachment', text: 'a'.repeat(4_000) }),
      makeItem({ id: 'tab', tier: 'currentTab', text: 't'.repeat(400) }),
    ]

    const result = applyContextBudget(items, { maxTokens: 100, contextWindow: 0, reservedOutputTokens: 0 })

    const selection = result.items.find((item) => item.id === 'sel')
    const attachment = result.items.find((item) => item.id === 'att')
    const currentTab = result.items.find((item) => item.id === 'tab')

    expect(selection?.truncated).toBe(false)
    expect(selection?.text).toBe('s'.repeat(40))
    // Attachment bi cat truoc currentTab (uu tien theo tier).
    expect(attachment?.truncated).toBe(true)
    expect(currentTab).toBeUndefined()
  })

  it('item vuot ngan sach bi cat phan dau va danh dau truncated', () => {
    const items = [makeItem({ id: 'a', tier: 'attachment', text: 'x'.repeat(1_000) })]

    const result = applyContextBudget(items, { maxTokens: 100, contextWindow: 0, reservedOutputTokens: 0 })
    const item = result.items[0]

    expect(item?.truncated).toBe(true)
    expect(item?.droppedChars).toBeGreaterThan(0)
    expect((item?.text ?? '').length).toBeLessThan(1_000)
    expect(item?.tokens).toBeLessThanOrEqual(result.maxTokens)
  })

  it('historyBudget la phan du sau khi cat context', () => {
    const items = [makeItem({ id: 'a', tier: 'attachment', text: 'x'.repeat(400) })]

    const result = applyContextBudget(items, { maxTokens: 1_000, contextWindow: 0, reservedOutputTokens: 0 })

    expect(result.historyBudget).toBe(result.maxTokens - result.usedTokens)
  })

  it('khong con cho → item bi bo hoan toan', () => {
    const items = [makeItem({ id: 'a', tier: 'attachment', text: 'x'.repeat(400) })]

    const result = applyContextBudget(items, { maxTokens: 0, contextWindow: 0, reservedOutputTokens: 0 })

    expect(result.maxTokens).toBe(0)
    expect(result.items).toHaveLength(0)
    expect(result.droppedItems).toBe(1)
  })

  it('thu tu uu tien: selection → attachment → currentTab', () => {
    const items = [
      makeItem({ id: 'tab', tier: 'currentTab', text: 't'.repeat(40) }),
      makeItem({ id: 'att', tier: 'attachment', text: 'a'.repeat(40) }),
      makeItem({ id: 'sel', tier: 'selection', text: 's'.repeat(40) }),
    ]

    const result = applyContextBudget(items, { maxTokens: 1_000, contextWindow: 0, reservedOutputTokens: 0 })

    expect(result.items.map((item) => item.id)).toEqual(['sel', 'att', 'tab'])
  })

  it('maxTokens am → 0 (khong bao gio tran)', () => {
    const result = applyContextBudget([], { contextWindow: 100, reservedOutputTokens: 0 })
    expect(result.maxTokens).toBe(0)
  })
})

describe('trimHistory', () => {
  it('lich su rong → mang rong', () => {
    expect(trimHistory([], 1_000)).toEqual([])
  })

  it('giu luot moi nhat du ngan sach tran', () => {
    const turns = [
      { role: 'user' as const, content: 'cau hoi 1' },
      { role: 'assistant' as const, content: 'tra loi 1' },
      { role: 'user' as const, content: 'cau hoi moi' },
    ]

    const kept = trimHistory(turns, 0)

    expect(kept).toHaveLength(1)
    expect(kept[0]?.content).toBe('cau hoi moi')
  })

  it('cat cac luot cu khi vuot ngan sach', () => {
    const turns = [
      { role: 'user' as const, content: 'a'.repeat(400) },
      { role: 'assistant' as const, content: 'b'.repeat(400) },
      { role: 'user' as const, content: 'cau hoi moi' },
    ]

    const kept = trimHistory(turns, 50)

    expect(kept).toHaveLength(1)
    expect(kept[0]?.content).toBe('cau hoi moi')
  })

  it('giu nguyen thu tu khi cat', () => {
    const turns = [
      { role: 'user' as const, content: 'hỏi 1' },
      { role: 'assistant' as const, content: 'đáp 1' },
      { role: 'user' as const, content: 'hỏi 2' },
    ]

    const kept = trimHistory(turns, 1_000)

    expect(kept.map((turn) => turn.content)).toEqual(['hỏi 1', 'đáp 1', 'hỏi 2'])
  })
})

describe('contextBundleSchema', () => {
  it('accept bundle hop le', () => {
    const parsed = contextBundleSchema.safeParse({
      items: [
        {
          id: 'tab-1',
          kind: 'tab',
          tier: 'attachment',
          title: 'Tieu de',
          text: 'noi dung',
        },
      ],
    })

    expect(parsed.success).toBe(true)
  })

  it('reject bundle qua 20 item', () => {
    const items = Array.from({ length: 21 }, (_value, index) => ({
      id: `item-${index}`,
      kind: 'tab' as const,
      tier: 'attachment' as const,
      title: 'T',
    }))

    expect(contextBundleSchema.safeParse({ items }).success).toBe(false)
  })

  it('reject item thieu tier', () => {
    expect(
      contextBundleSchema.safeParse({
        items: [{ id: 'a', kind: 'tab', title: 'T' }],
      }).success,
    ).toBe(false)
  })
})
