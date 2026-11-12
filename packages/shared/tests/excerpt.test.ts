import { describe, expect, it } from 'vitest'
import { LIMITS } from '../src/constants.js'
import { clampExcerpt } from '../src/excerpt.js'
import { chatRequestSchema, contextItemSchema, pageContextSchema } from '../src/schemas/chat.js'

/**
 * Regression test cho bug T-M2-23: `excerpt` vuot gioi han lam chat 400.
 *
 * ## Bug
 *
 * Nhieu noi cat `text.slice(0, 500)` roi **them** `"..."` → 503 ky tu →
 * `contextItemSchema` reject → `chatRequestSchema` reject →
 * `POST /api/chat` tra **400 "Body chat khong hop le"** →
 * panel **khong chat duoc** sau khi dinh kem 1 tai lieu.
 *
 * ## Fix
 *
 * 1. `clampExcerpt` (helper thuan, dung chung) — cat sao cho tong do dai
 *    (ke ca dau `...`) **<=** `LIMITS.MAX_EXCERPT_CHARS`.
 * 2. `contextItemSchema` / `pageContextSchema` — `excerpt` **tu cat** thay vi
 *    reject → context item khong hop le khong lam hong ca request chat.
 */

describe('clampExcerpt', () => {
  it('giu nguyen chuoi ngan hon gioi han', () => {
    expect(clampExcerpt('abc', 10)).toBe('abc')
  })

  it('cat + them ellipsis khi vuot gioi han', () => {
    const result = clampExcerpt('a'.repeat(20), 10)
    expect(result).toBe('aaaaaaa...')
    expect(result).toHaveLength(10)
  })

  it('khong bao gio vuot gioi han (ke ca dau ellipsis)', () => {
    for (const max of [1, 2, 3, 4, 10, 500]) {
      const result = clampExcerpt('x'.repeat(1000), max)
      expect(result.length).toBeLessThanOrEqual(max)
    }
  })

  it('cat thang khi gioi han <= 3 (khong con cho dau ellipsis)', () => {
    expect(clampExcerpt('abcdef', 3)).toBe('abc')
    expect(clampExcerpt('abcdef', 2)).toBe('ab')
    expect(clampExcerpt('abcdef', 0)).toBe('')
  })

  it('bo khoang trang thua truoc dau ellipsis', () => {
    const result = clampExcerpt('a'.repeat(5) + '   ' + 'b'.repeat(20), 10)
    expect(result.endsWith('...')).toBe(true)
    // `trimEnd()` bo khoang trang thua → chuoi co the **ngan hon** gioi han.
    expect(result.length).toBeLessThanOrEqual(10)
    expect(result.startsWith('aaaaa')).toBe(true)
  })
})

describe('contextItemSchema — excerpt tu cat thay vi reject', () => {
  it('accept excerpt vuot gioi han va cat lai', () => {
    const parsed = contextItemSchema.safeParse({
      id: 'doc-1',
      kind: 'file',
      tier: 'attachment',
      title: 'sach.pdf',
      text: 'Noi dung',
      excerpt: 'a'.repeat(LIMITS.MAX_EXCERPT_CHARS + 3),
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.excerpt?.length).toBeLessThanOrEqual(LIMITS.MAX_EXCERPT_CHARS)
    }
  })

  it('accept excerpt 503 ky tu (dung format "cat 500 + ...")', () => {
    const excerpt = `${'a'.repeat(LIMITS.MAX_EXCERPT_CHARS)}...`
    const parsed = contextItemSchema.safeParse({
      id: 'doc-1',
      kind: 'file',
      tier: 'attachment',
      title: 'sach.pdf',
      text: 'Noi dung',
      excerpt,
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.excerpt?.length).toBeLessThanOrEqual(LIMITS.MAX_EXCERPT_CHARS)
    }
  })

  it('giu nguyen excerpt ngan hon gioi han', () => {
    const parsed = contextItemSchema.safeParse({
      id: 'doc-1',
      kind: 'file',
      tier: 'attachment',
      title: 'sach.pdf',
      excerpt: 'Ngan',
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.excerpt).toBe('Ngan')
    }
  })
})

describe('pageContextSchema — excerpt tu cat thay vi reject', () => {
  it('accept excerpt vuot gioi han va cat lai', () => {
    const parsed = pageContextSchema.safeParse({
      url: 'https://a.b',
      title: 'T',
      excerpt: 'x'.repeat(LIMITS.MAX_EXCERPT_CHARS + 1),
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.excerpt?.length).toBeLessThanOrEqual(LIMITS.MAX_EXCERPT_CHARS)
    }
  })
})

describe('chatRequestSchema — context co excerpt vuot han van duoc accept', () => {
  it('khong reject request vi excerpt qua dai (fix bug "khong chat duoc")', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        items: [
          {
            id: 'doc-1',
            kind: 'file',
            tier: 'attachment',
            title: 'sach.pdf',
            text: 'Noi dung sach',
            excerpt: `${'a'.repeat(LIMITS.MAX_EXCERPT_CHARS)}...`,
            fileName: 'sach.pdf',
            mimeType: 'application/pdf',
          },
        ],
      },
    })

    expect(parsed.success).toBe(true)
  })

  it('van reject context item thieu field bat buoc', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        items: [
          {
            id: 'doc-1',
            kind: 'file',
            tier: 'attachment',
            // thieu `title` → van phai reject
          },
        ],
      },
    })

    expect(parsed.success).toBe(false)
  })
})
