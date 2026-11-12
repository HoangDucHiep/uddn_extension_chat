import { describe, expect, it } from 'vitest'
import { LIMITS } from '../src/constants.js'
import { chatRequestSchema, contextItemSchema, pageContextSchema } from '../src/schemas/chat.js'

describe('pageContextSchema', () => {
  it('accept context toi thieu co url + title', () => {
    const parsed = pageContextSchema.safeParse({ url: 'https://a.b', title: 'T' })
    expect(parsed.success).toBe(true)
  })

  it('accept context co text va excerpt', () => {
    const parsed = pageContextSchema.safeParse({
      url: 'https://a.b',
      title: 'T',
      text: 'Noi dung chinh cua trang',
      excerpt: 'Noi dung chinh',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.text).toBe('Noi dung chinh cua trang')
      expect(parsed.data.excerpt).toBe('Noi dung chinh')
    }
  })

  it('reject text vuot gioi han trang', () => {
    const parsed = pageContextSchema.safeParse({
      url: 'https://a.b',
      title: 'T',
      text: 'x'.repeat(LIMITS.MAX_PAGE_TEXT_CHARS + 1),
    })
    expect(parsed.success).toBe(false)
  })

  it('excerpt vuot gioi han → TU CAT (khong reject) — fix T-M2-23', () => {
    // Trước đây reject → `POST /api/chat` 400 → panel không chat được.
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

  it('reject thieu url', () => {
    expect(pageContextSchema.safeParse({ title: 'T' }).success).toBe(false)
  })
})

describe('chatRequestSchema', () => {
  it('accept request co context day du', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        url: 'https://a.b',
        title: 'T',
        text: 'Noi dung trang',
        excerpt: 'Noi dung',
        tabId: 12,
      },
    })
    expect(parsed.success).toBe(true)
  })

  it('shape cu (flat) duoc chuan hoa thanh bundle items[]', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        url: 'https://a.b',
        title: 'T',
        text: 'Noi dung trang',
      },
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      const context = parsed.data.context
      expect(context?.items).toHaveLength(1)
      expect(context?.items[0]?.tier).toBe('currentTab')
      expect(context?.items[0]?.text).toBe('Noi dung trang')
    }
  })

  it('shape cu co selectedText → them item tier selection', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        url: 'https://a.b',
        title: 'T',
        selectedText: 'Doan boi den',
      },
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      const tiers = parsed.data.context?.items.map((item) => item.tier)
      expect(tiers).toContain('selection')
      expect(tiers).toContain('currentTab')
    }
  })

  it('shape moi (bundle items[]) duoc giu nguyen', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        items: [
          {
            id: 'tab-1',
            kind: 'tab',
            tier: 'attachment',
            title: 'T',
            text: 'Noi dung',
          },
        ],
      },
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.context?.items).toHaveLength(1)
      expect(parsed.data.context?.items[0]?.tier).toBe('attachment')
    }
  })

  it('khong co context → khong co key context', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'user', content: 'Xin chao' }],
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.context).toBeUndefined()
    }
  })

  it('reject message rong', () => {
    const parsed = chatRequestSchema.safeParse({ messages: [{ role: 'user', content: '' }] })
    expect(parsed.success).toBe(false)
  })

  it('reject role khong hop le', () => {
    const parsed = chatRequestSchema.safeParse({
      messages: [{ role: 'robot', content: 'Xin chao' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('reject role thieu', () => {
    const parsed = chatRequestSchema.safeParse({ messages: [{ content: 'Xin chao' }] })
    expect(parsed.success).toBe(false)
  })

  it('accept cac role hop le', () => {
    for (const role of ['user', 'assistant', 'system'] as const) {
      const parsed = chatRequestSchema.safeParse({ messages: [{ role, content: 'Xin chao' }] })
      expect(parsed.success).toBe(true)
    }
  })

  it('reject messages rong (khong co luot nao)', () => {
    const parsed = chatRequestSchema.safeParse({ messages: [] })
    expect(parsed.success).toBe(false)
  })

  it('reject messages vuot gioi han lich su', () => {
    const messages = Array.from({ length: LIMITS.MAX_HISTORY_MESSAGES + 1 }, () => ({
      role: 'user' as const,
      content: 'x',
    }))

    const parsed = chatRequestSchema.safeParse({ messages })
    expect(parsed.success).toBe(false)
  })

  it('accept messages bang dung gioi han lich su', () => {
    const messages = Array.from({ length: LIMITS.MAX_HISTORY_MESSAGES }, () => ({
      role: 'user' as const,
      content: 'x',
    }))

    const parsed = chatRequestSchema.safeParse({ messages })
    expect(parsed.success).toBe(true)
  })
})

describe('contextItemSchema', () => {
  it('reject id rong', () => {
    const parsed = contextItemSchema.safeParse({
      id: '',
      kind: 'tab',
      tier: 'attachment',
      title: 'T',
    })
    expect(parsed.success).toBe(false)
  })

  it('reject id thieu', () => {
    const parsed = contextItemSchema.safeParse({
      kind: 'tab',
      tier: 'attachment',
      title: 'T',
    })
    expect(parsed.success).toBe(false)
  })

  it('reject kind khong hop le', () => {
    const parsed = contextItemSchema.safeParse({
      id: 'a',
      kind: 'screenshot',
      tier: 'attachment',
      title: 'T',
    })
    expect(parsed.success).toBe(false)
  })

  it('reject tier khong hop le', () => {
    const parsed = contextItemSchema.safeParse({
      id: 'a',
      kind: 'tab',
      tier: 'lowPriority',
      title: 'T',
    })
    expect(parsed.success).toBe(false)
  })

  it('reject title vuot gioi han', () => {
    const parsed = contextItemSchema.safeParse({
      id: 'a',
      kind: 'tab',
      tier: 'attachment',
      title: 'x'.repeat(1001),
    })
    expect(parsed.success).toBe(false)
  })

  it('reject tabId khong phai so nguyen', () => {
    const parsed = contextItemSchema.safeParse({
      id: 'a',
      kind: 'tab',
      tier: 'attachment',
      title: 'T',
      tabId: 1.5,
    })
    expect(parsed.success).toBe(false)
  })
})
