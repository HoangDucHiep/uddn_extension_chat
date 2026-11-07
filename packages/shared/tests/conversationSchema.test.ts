import { describe, expect, it } from 'vitest'
import { conversationListQuerySchema } from '../src/schemas/chat.js'
import {
  conversationMessagesResponseSchema,
  conversationSummarySchema,
  updateConversationSchema,
} from '../src/schemas/conversation.js'

/**
 * Unit test cho schema CRUD conversation (FR-CHAT-08/09/11 — T-M1-09).
 * Docs: docs/SYSTEM_DESIGN.md §7.10
 */

const validSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Chat 1',
  pinned: false,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  messageCount: 2,
}

describe('conversationSummarySchema', () => {
  it('accept summary hop le', () => {
    const parsed = conversationSummarySchema.safeParse(validSummary)
    expect(parsed.success).toBe(true)
  })

  it('reject id khong phai UUID', () => {
    const parsed = conversationSummarySchema.safeParse({ ...validSummary, id: 'abc' })
    expect(parsed.success).toBe(false)
  })

  it('default messageCount = 0 khi thieu', () => {
    const { messageCount: _messageCount, ...rest } = validSummary
    const parsed = conversationSummarySchema.safeParse(rest)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.messageCount).toBe(0)
    }
  })
})

describe('updateConversationSchema', () => {
  it('accept chi doi ten', () => {
    const parsed = updateConversationSchema.safeParse({ title: 'Moi' })
    expect(parsed.success).toBe(true)
  })

  it('accept chi ghim', () => {
    const parsed = updateConversationSchema.safeParse({ pinned: true })
    expect(parsed.success).toBe(true)
  })

  it('reject body rong', () => {
    const parsed = updateConversationSchema.safeParse({})
    expect(parsed.success).toBe(false)
  })

  it('reject tieu de qua dai', () => {
    const parsed = updateConversationSchema.safeParse({ title: 'x'.repeat(201) })
    expect(parsed.success).toBe(false)
  })
})

describe('conversationListQuerySchema', () => {
  it('default archived = false', () => {
    const parsed = conversationListQuerySchema.safeParse({})
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.archived).toBe(false)
      expect(parsed.data.limit).toBe(30)
    }
  })

  it('parse archived=true tu query string', () => {
    const parsed = conversationListQuerySchema.safeParse({ archived: 'true' })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.archived).toBe(true)
    }
  })

  it('reject limit vuot gioi han', () => {
    const parsed = conversationListQuerySchema.safeParse({ limit: '1000' })
    expect(parsed.success).toBe(false)
  })
})

describe('conversationMessagesResponseSchema', () => {
  it('accept lich su co citations', () => {
    const parsed = conversationMessagesResponseSchema.safeParse({
      conversation: validSummary,
      messages: [
        {
          id: '21111111-1111-4111-8111-111111111111',
          role: 'assistant',
          content: 'Tra loi',
          createdAt: '2026-01-01T00:00:01.000Z',
          provider: 'groq',
          citations: [
            {
              index: 1,
              url: 'https://a.test',
              title: 'Nguon',
              snippet: 'Doan',
            },
          ],
        },
      ],
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.messages[0]?.citations[0]?.url).toBe('https://a.test')
    }
  })

  it('default citations = [] khi thieu', () => {
    const parsed = conversationMessagesResponseSchema.safeParse({
      conversation: validSummary,
      messages: [
        {
          id: '31111111-1111-4111-8111-111111111111',
          role: 'user',
          content: 'Hoi',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.messages[0]?.citations).toEqual([])
    }
  })

  it('reject role khong hop le', () => {
    const parsed = conversationMessagesResponseSchema.safeParse({
      conversation: validSummary,
      messages: [
        {
          id: '41111111-1111-4111-8111-111111111111',
          role: 'system-admin',
          content: 'X',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })

    expect(parsed.success).toBe(false)
  })
})
