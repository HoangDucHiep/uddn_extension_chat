import { describe, expect, it } from 'vitest'
import {
  chatOperationSchema,
  chatRequestSchema,
  conversationMessageSchema,
  conversationMessagesResponseSchema,
  conversationTurnSchema,
} from '../src/index.js'

/**
 * Unit test cho contract T-M1-10 (chat operation + turn/variant).
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.11
 */

describe('chatOperationSchema', () => {
  it('chap nhan 4 operation', () => {
    expect(chatOperationSchema.parse('send')).toBe('send')
    expect(chatOperationSchema.parse('regenerate')).toBe('regenerate')
    expect(chatOperationSchema.parse('continue')).toBe('continue')
    expect(chatOperationSchema.parse('branch')).toBe('branch')
  })

  it('tu choi operation la', () => {
    expect(chatOperationSchema.safeParse('delete').success).toBe(false)
  })
})

describe('chatRequestSchema', () => {
  const base = { messages: [{ role: 'user' as const, content: 'cau hoi' }] }

  it('operation la optional (client cu khong gui → undefined)', () => {
    const parsed = chatRequestSchema.parse(base)
    expect(parsed.operation).toBeUndefined()
  })

  it('parse operation hop le', () => {
    const parsed = chatRequestSchema.parse({ ...base, operation: 'regenerate' })
    expect(parsed.operation).toBe('regenerate')
  })

  it('parse assistantMessageId + parentTurnId', () => {
    const parsed = chatRequestSchema.parse({
      ...base,
      operation: 'continue',
      assistantMessageId: '11111111-2222-4333-8444-555555555555',
      parentTurnId: 'turn-1',
    })
    expect(parsed.assistantMessageId).toBe('11111111-2222-4333-8444-555555555555')
    expect(parsed.parentTurnId).toBe('turn-1')
  })

  it('tu choi operation la', () => {
    expect(chatRequestSchema.safeParse({ ...base, operation: 'nope' }).success).toBe(
      false,
    )
  })

  it('assistantMessageId phai la uuid', () => {
    expect(
      chatRequestSchema.safeParse({ ...base, assistantMessageId: 'khong-phai-uuid' })
        .success,
    ).toBe(false)
  })
})

describe('conversationMessageSchema', () => {
  it('parse message kem field turn/variant', () => {
    const parsed = conversationMessageSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      role: 'assistant',
      content: 'x',
      createdAt: '2026-01-01T00:00:00.000Z',
      turnId: 'turn-1',
      variantIndex: 1,
      active: false,
      parentTurnId: 'turn-0',
      aborted: true,
    })

    expect(parsed.turnId).toBe('turn-1')
    expect(parsed.variantIndex).toBe(1)
    expect(parsed.active).toBe(false)
    expect(parsed.parentTurnId).toBe('turn-0')
    expect(parsed.aborted).toBe(true)
  })

  it('field turn van duoc cho phep (du lieu cu)', () => {
    const parsed = conversationMessageSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      role: 'user',
      content: 'x',
      createdAt: '2026-01-01T00:00:00.000Z',
    })

    expect(parsed.turnId).toBeUndefined()
  })
})

describe('conversationTurnSchema', () => {
  it('parse turn co bien the + onPath', () => {
    const parsed = conversationTurnSchema.parse({
      turnId: 'turn-1',
      userMessageId: '11111111-2222-4333-8444-555555555555',
      userContent: 'cau hoi',
      onPath: true,
      variants: [
        {
          id: '22222222-2222-4333-8444-555555555555',
          variantIndex: 0,
          content: 'tra loi',
          createdAt: '2026-01-01T00:00:00.000Z',
          active: true,
        },
      ],
    })

    expect(parsed.onPath).toBe(true)
    expect(parsed.variants).toHaveLength(1)
  })
})

describe('conversationMessagesResponseSchema', () => {
  it('parse response co path + turns', () => {
    const parsed = conversationMessagesResponseSchema.parse({
      conversation: {
        id: '11111111-2222-4333-8444-555555555555',
        title: 'Cau hoi',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 2,
        pinned: false,
        archived: false,
      },
      messages: [],
      path: ['turn-1'],
      turns: [],
    })

    expect(parsed.path).toEqual(['turn-1'])
    expect(parsed.turns).toEqual([])
  })

  it('path/turns co default rong (tuong thich du lieu cu)', () => {
    const parsed = conversationMessagesResponseSchema.parse({
      conversation: {
        id: '11111111-2222-4333-8444-555555555555',
        title: 'Cau hoi',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        messageCount: 0,
        pinned: false,
        archived: false,
      },
      messages: [],
    })

    expect(parsed.path).toEqual([])
    expect(parsed.turns).toEqual([])
  })
})
