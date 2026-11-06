import { describe, expect, it } from 'vitest'
import type { ContextItem } from '@sidekick/shared'
import { buildSnippet, extractCitations } from '../src/services/citationService.js'

/**
 * Test cho `citationService` — trich xuat nguon theo marker `[N]`
 * (FR-CONTEXT-10 — T-M1-08).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

const source1: ContextItem = {
  id: 'sel-1',
  kind: 'selection',
  tier: 'selection',
  title: 'Doan boi den',
  excerpt: 'Doan trich dan ngan.',
}

const source2: ContextItem = {
  id: 'tab-1',
  kind: 'tab',
  tier: 'attachment',
  url: 'https://example.com/bai-viet',
  title: 'Bai viet',
  text: 'Noi dung chinh cua trang web.',
}

describe('extractCitations', () => {
  it('resolve marker thanh nguon tuong ung', () => {
    const citations = extractCitations('Gia do la 30% [1].', [source1, source2])

    expect(citations).toHaveLength(1)
    expect(citations[0]).toMatchObject({
      index: 1,
      title: 'Doan boi den',
      snippet: 'Doan trich dan ngan.',
    })
  })

  it('resolve nhieu nguon theo thu tu tang dan', () => {
    const citations = extractCitations('a [2] b [1]', [source1, source2])

    expect(citations.map((item) => item.index)).toEqual([1, 2])
  })

  it('bo qua marker tro toi nguon khong ton tai', () => {
    const citations = extractCitations('Nguon [9] khong co', [source1, source2])

    expect(citations).toHaveLength(0)
  })

  it('marker trung lap chi emit 1 lan', () => {
    const citations = extractCitations('[1] ... [1] ... [1]', [source1, source2])

    expect(citations).toHaveLength(1)
  })

  it('text khong co marker → khong co citation', () => {
    expect(extractCitations('Khong trich dan gi ca', [source1])).toHaveLength(0)
  })

  it('khong co nguon → khong co citation', () => {
    expect(extractCitations('Trich dan [1]', [])).toHaveLength(0)
  })

  it('giu URL va tabId cua nguon', () => {
    const withTab: ContextItem = { ...source2, tabId: 42 }
    const citations = extractCitations('x [1]', [withTab])

    expect(citations[0]).toMatchObject({ url: 'https://example.com/bai-viet', tabId: 42 })
  })

  it('nguon khong co URL → url rong (khong undefined)', () => {
    const citations = extractCitations('x [1]', [source1])

    expect(citations[0]?.url).toBe('')
  })
})

describe('buildSnippet', () => {
  it('uu tien excerpt', () => {
    expect(buildSnippet({ ...source1, text: 'text day du' })).toBe('Doan trich dan ngan.')
  })

  it('fallback sang text khi khong co excerpt', () => {
    expect(buildSnippet(source2)).toBe('Noi dung chinh cua trang web.')
  })

  it('cat text dai va them dau "…"', () => {
    const long: ContextItem = { ...source2, excerpt: undefined, text: 'x'.repeat(1_000) }
    const snippet = buildSnippet(long)

    expect(snippet.length).toBeLessThanOrEqual(321)
    expect(snippet.endsWith('…')).toBe(true)
  })

  it('nguon rong → snippet rong', () => {
    expect(buildSnippet({ ...source2, excerpt: undefined, text: undefined })).toBe('')
  })
})
