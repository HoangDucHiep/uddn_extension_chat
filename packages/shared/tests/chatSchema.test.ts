import { describe, expect, it } from 'vitest'
import { LIMITS } from '../src/constants.js'
import { chatRequestSchema, pageContextSchema } from '../src/schemas/chat.js'

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

  it('reject excerpt vuot gioi han', () => {
    const parsed = pageContextSchema.safeParse({
      url: 'https://a.b',
      title: 'T',
      excerpt: 'x'.repeat(LIMITS.MAX_EXCERPT_CHARS + 1),
    })
    expect(parsed.success).toBe(false)
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

  it('reject message rong', () => {
    const parsed = chatRequestSchema.safeParse({ messages: [{ role: 'user', content: '' }] })
    expect(parsed.success).toBe(false)
  })
})
