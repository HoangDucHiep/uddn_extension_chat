import { describe, expect, it } from 'vitest'
import { CONTINUE_INSTRUCTION, type ChatEvent } from '@sidekick/shared'
import { ProviderRegistry } from '../src/providers/registry.js'
import {
  buildProviderMessages,
  createChatStream,
  type ChatServiceDeps,
} from '../src/services/chatService.js'
import { createFakeConversationDb } from './helpers/fakeConversationDb.js'

/**
 * Unit test cho cac thao tac chat cua server (T-M1-10).
 *
 * - `send` → tao turn moi.
 * - `regenerate` → tao bien the moi, bien the cu `active = false`.
 * - `branch` → cat duong di, gan `parentTurnId`.
 * - `continue` → UPDATE message (khong tao message moi) + them chi dan.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.11
 */

/**
 * Tao registry voi provider `mock` (khong can key).
 */
function makeRegistry(): ProviderRegistry {
  return new ProviderRegistry({
    defaultProvider: 'mock',
    fallbacks: [],
    groqModel: 'openai/gpt-oss-120b',
    openRouterModel: 'google/gemini-2.5-flash',
    geminiModel: 'gemini-3.6-flash',
  })
}

/**
 * Tao deps cho service voi fake DB.
 */
function makeDeps(): ChatServiceDeps & {
  fake: ReturnType<typeof createFakeConversationDb>
} {
  const fake = createFakeConversationDb()
  return {
    db: fake.db as never,
    registry: makeRegistry(),
    envKeys: {},
    masterKey: undefined,
    logFullContent: false,
    logRequests: false,
    logContextSnapshot: false,
    fake,
  }
}

/**
 * Chay het stream va gom cac event.
 *
 * @param deps - Chat service deps.
 * @param request - Request gui len.
 */
async function collect(
  deps: ChatServiceDeps,
  request: Parameters<typeof createChatStream>[1],
): Promise<ChatEvent[]> {
  const controller = new AbortController()
  const stream = createChatStream(deps, request, controller.signal)
  const events: ChatEvent[] = []
  for await (const event of stream.events) {
    events.push(event)
  }
  return events
}

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555'

describe('chatService — operations T-M1-10', () => {
  it('send: tao user message + assistant message cung turn', async () => {
    const deps = makeDeps()

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'xin chao' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const meta = events.find((event) => event.type === 'meta')
    if (meta?.type !== 'meta') throw new Error('thieu meta event')
    expect(meta.turnId).toBeDefined()

    // 2 message duoc insert: user + assistant.
    expect(deps.fake.messageRows).toHaveLength(2)
    expect(deps.fake.messageRows[0]?.role).toBe('user')
    expect(deps.fake.messageRows[1]?.role).toBe('assistant')
    // Cung `turnId`.
    expect(deps.fake.messageRows[0]?.meta['turnId']).toBe(meta.turnId)
    expect(deps.fake.messageRows[1]?.meta['turnId']).toBe(meta.turnId)
    // User message variantIndex 0, assistant variantIndex 0.
    expect(deps.fake.messageRows[0]?.meta['variantIndex']).toBe(0)
    expect(deps.fake.messageRows[1]?.meta['variantIndex']).toBe(0)
  })

  it('send: ghi duong di vao conversations.meta.path', async () => {
    const deps = makeDeps()

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'xin chao' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
    })

    const meta = events.find((event) => event.type === 'meta')
    if (meta?.type !== 'meta') throw new Error('thieu meta event')

    const conversation = deps.fake.conversationRows[0]
    expect(conversation?.meta['path']).toEqual([meta.turnId])
  })

  it('regenerate: tao bien the moi, khong tao user message moi', async () => {
    const deps = makeDeps()

    deps.fake.seedConversation({ id: CONVERSATION_ID })
    deps.fake.seedMessage({
      id: 'aaaaaaaa-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: 'cau hoi',
      meta: { turnId: 'turn-1', variantIndex: 0, active: true },
    })
    deps.fake.seedMessage({
      id: 'bbbbbbbb-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'assistant',
      content: 'cau tra loi cu',
      meta: { turnId: 'turn-1', variantIndex: 0, active: true },
    })

    await collect(deps, {
      messages: [{ role: 'user', content: 'cau hoi' }],
      conversationId: CONVERSATION_ID,
      operation: 'regenerate',
      assistantMessageId: 'bbbbbbbb-1111-4333-8444-555555555555',
    })

    // Chi them 1 message assistant (khong them user message).
    expect(deps.fake.messageRows).toHaveLength(3)
    const inserted = deps.fake.messageRows[2]
    expect(inserted?.role).toBe('assistant')
    expect(inserted?.meta['variantIndex']).toBe(1)
    expect(inserted?.meta['turnId']).toBe('turn-1')
    expect(inserted?.meta['active']).toBe(true)

    // Variant cu → active = false.
    expect(deps.fake.messageRows[1]?.meta['active']).toBe(false)
  })

  it('branch: cat duong di tai turn cha + gan parentTurnId', async () => {
    const deps = makeDeps()

    deps.fake.seedConversation({
      id: CONVERSATION_ID,
      meta: { path: ['turn-1', 'turn-2'] },
    })
    deps.fake.seedMessage({
      id: 'aaaaaaaa-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: 'cau 1',
      meta: { turnId: 'turn-1', variantIndex: 0, active: true },
    })
    deps.fake.seedMessage({
      id: 'cccccccc-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'user',
      content: 'cau 2',
      meta: { turnId: 'turn-2', variantIndex: 0, active: true },
    })
    deps.fake.seedMessage({
      id: 'dddddddd-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'assistant',
      content: 'tra loi 2',
      meta: { turnId: 'turn-2', variantIndex: 0, active: true },
    })

    await collect(deps, {
      messages: [{ role: 'user', content: 'cau 2 sua lai' }],
      conversationId: CONVERSATION_ID,
      operation: 'branch',
      parentTurnId: 'turn-2',
    })

    // Path moi = phan truoc turn cha + turn moi.
    const conversation = deps.fake.conversationRows[0]
    const path = conversation?.meta['path'] as string[]
    expect(path[0]).toBe('turn-1')
    expect(path).toHaveLength(2)
    expect(path[1]).not.toBe('turn-2')

    // User message moi co `parentTurnId`.
    const inserted = deps.fake.messageRows[3]
    expect(inserted?.meta['parentTurnId']).toBe('turn-2')

    // Turn bi cat → active = false.
    expect(deps.fake.messageRows[1]?.meta['active']).toBe(false)
    expect(deps.fake.messageRows[2]?.meta['active']).toBe(false)
  })

  it('continue: UPDATE message da bi stop (khong tao message moi)', async () => {
    const deps = makeDeps()

    deps.fake.seedConversation({ id: CONVERSATION_ID })
    deps.fake.seedMessage({
      id: 'eeeeeeee-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'assistant',
      content: 'phan bi ngat',
      meta: { turnId: 'turn-1', variantIndex: 0, active: true, aborted: true },
    })

    await collect(deps, {
      messages: [
        { role: 'user', content: 'cau hoi' },
        { role: 'assistant', content: 'phan bi ngat' },
      ],
      conversationId: CONVERSATION_ID,
      operation: 'continue',
      assistantMessageId: 'eeeeeeee-1111-4333-8444-555555555555',
    })

    // Khong tao message moi.
    expect(deps.fake.messageRows).toHaveLength(1)
    // Noi dung duoc ghep noi dung cu + phan moi.
    const updated = deps.fake.messageRows[0]
    expect(updated?.content.startsWith('phan bi ngat')).toBe(true)
    expect(updated?.content.length).toBeGreaterThan('phan bi ngat'.length)
    // `aborted` → false.
    expect(updated?.meta['aborted']).toBe(false)
  })

  it('continue: provider nhan chi dan CONTINUE_INSTRUCTION', () => {
    // Lich su ket thuc bang assistant (phan da ngat) → chi dan duoc them
    // thanh 1 user turn moi (assistant → user la chuoi hop le).
    const messages = buildProviderMessages(
      {
        messages: [
          { role: 'user', content: 'cau hoi' },
          { role: 'assistant', content: 'phan bi ngat' },
        ],
        operation: 'continue',
      },
      { extraUserInstruction: CONTINUE_INSTRUCTION },
    )

    const last = messages[messages.length - 1]
    expect(last?.content).toContain(CONTINUE_INSTRUCTION)
    expect(last?.role).toBe('user')
    // system + user + assistant + user(chi dan) = 4.
    expect(messages).toHaveLength(4)
  })

  it('continue: chi dan duoc ghep vao user turn cuoi cung (khong tao 2 user turn lien tiep)', () => {
    const messages = buildProviderMessages(
      {
        messages: [{ role: 'user', content: 'cau hoi' }],
        operation: 'continue',
      },
      { extraUserInstruction: CONTINUE_INSTRUCTION },
    )

    const last = messages[messages.length - 1]
    expect(last?.role).toBe('user')
    expect(last?.content).toContain('cau hoi')
    expect(last?.content).toContain(CONTINUE_INSTRUCTION)
    // system + user = 2.
    expect(messages).toHaveLength(2)
  })

  it('regenerate: meta event kem turnId', async () => {
    const deps = makeDeps()

    deps.fake.seedConversation({ id: CONVERSATION_ID })
    deps.fake.seedMessage({
      id: 'bbbbbbbb-1111-4333-8444-555555555555',
      conversationId: CONVERSATION_ID,
      role: 'assistant',
      content: 'cau tra loi cu',
      meta: { turnId: 'turn-1', variantIndex: 0, active: true },
    })

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'cau hoi' }],
      conversationId: CONVERSATION_ID,
      operation: 'regenerate',
      assistantMessageId: 'bbbbbbbb-1111-4333-8444-555555555555',
    })

    const meta = events.find((event) => event.type === 'meta')
    if (meta?.type !== 'meta') throw new Error('thieu meta event')
    expect(meta.turnId).toBe('turn-1')
  })
})
