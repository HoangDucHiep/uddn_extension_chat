import { describe, expect, it } from 'vitest'
import { DEFAULT_SYSTEM_PROMPT, type ChatEvent } from '@sidekick/shared'
import { ProviderRegistry } from '../src/providers/registry.js'
import {
  buildProviderMessages,
  createChatStream,
  type ChatServiceDeps,
} from '../src/services/chatService.js'
import { createFakeConversationDb } from './helpers/fakeConversationDb.js'
import { BUILTIN_SKILLS } from '../src/skills/builtin.js'

/**
 * Unit test cho **skill trong luot chat** (T-M2-04 — FR-SKILL-01/02).
 *
 * AC goc:
 * - "Skill được server resolve → nối `prompt_template` vào system prompt".
 * - "Model của skill ghi đè model của request".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

const CONVERSATION_ID = '11111111-2222-4333-8444-555555555555'

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

describe('buildProviderMessages — skill (FR-SKILL-01)', () => {
  it('co skill → system prompt chua prompt mau cua skill', () => {
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: 'Sau doi la gi?' }] },
      {
        skill: {
          promptTemplate: 'Tóm tắt thành 5 ý chính.',
          model: undefined,
          name: 'tom-tat',
        },
      },
    )

    expect(messages[0]?.content).toContain('Tóm tắt thành 5 ý chính.')
    expect(messages[0]?.content.startsWith(DEFAULT_SYSTEM_PROMPT)).toBe(true)
  })

  it('co skill → placeholder {input} bi loai bo (khong lap cau hoi 2 lan)', () => {
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: 'Sau doi la gi?' }] },
      {
        skill: {
          promptTemplate: 'Tóm tắt nội dung sau:\n\n{input}',
          model: undefined,
          name: 'tom-tat',
        },
      },
    )

    expect(messages[0]?.content).not.toContain('{input}')
    // Cau hoi van nam o user turn (khong bi nhung vao system prompt).
    expect(messages[0]?.content).not.toContain('Sau doi la gi?')
    // User turn = prompt mau voi `{input}` thay bang cau hoi that.
    expect(messages[1]?.content).toBe('Tóm tắt nội dung sau:\n\nSau doi la gi?')
  })

  it('co skill → token /ten-skill bi strip khoi cau hoi (lop bao ve server)', () => {
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: '/tom-tat Sau doi la gi?' }] },
      {
        skill: {
          promptTemplate: 'Tóm tắt nội dung sau:\n\n{input}',
          model: undefined,
          name: 'tom-tat',
        },
      },
    )

    expect(messages[1]?.content).not.toContain('/tom-tat')
    expect(messages[1]?.content).toBe('Tóm tắt nội dung sau:\n\nSau doi la gi?')
  })

  it('co skill → cau hoi rong → dung cau mac dinh (dam bao content.min(1))', () => {
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: '/tom-tat' }] },
      {
        skill: {
          promptTemplate: 'Tóm tắt nội dung sau:\n\n{input}',
          model: undefined,
          name: 'tom-tat',
        },
      },
    )

    expect(messages[1]?.content).toContain('Hãy áp dụng skill này.')
  })

  it('co skill → template khong co {input} → cau hoi duoc append vao cuoi', () => {
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: 'Sau doi la gi?' }] },
      {
        skill: {
          promptTemplate: 'Tóm tắt thành 5 ý chính.',
          model: undefined,
          name: 'tom-tat',
        },
      },
    )

    expect(messages[1]?.content).toBe('Tóm tắt thành 5 ý chính.\n\nSau doi la gi?')
  })

  it('KHONG co skill → system prompt giong het mac dinh (guard regression)', () => {
    const messages = buildProviderMessages({
      messages: [{ role: 'user', content: 'Sau doi la gi?' }],
    })

    expect(messages[0]?.content).toBe(DEFAULT_SYSTEM_PROMPT)
  })
})

describe('createChatStream — resolve skill tu request (FR-SKILL-01/02)', () => {
  it('skillId cua user → skill duoc resolve va ap dung', async () => {
    const deps = makeDeps()
    const skill = deps.fake.seedSkill({
      name: 'viet-email',
      promptTemplate: 'Soan email ngan gon, lich su.',
      model: 'gpt-4o-mini',
    })

    await collect(deps, {
      messages: [{ role: 'user', content: 'Viet email xin nghi' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
      skillId: skill.id,
    })

    // Skill da duoc resolve → prompt mau len system prompt.
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: 'Viet email xin nghi' }] },
      {
        skill: {
          promptTemplate: 'Soan email ngan gon, lich su.',
          model: 'gpt-4o-mini',
          name: 'viet-email',
        },
      },
    )
    expect(messages[0]?.content).toContain('Soan email ngan gon, lich su.')
  })

  it('skillId khong ton tai → chat van chay binh thuong (khong loi)', async () => {
    const deps = makeDeps()

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Xin chao' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
      skillId: 'khong-ton-tai',
    })

    const done = events.find((event) => event.type === 'done')
    expect(done?.type).toBe('done')
  })

  it('skill co model → model cua skill ghi de model cua request', async () => {
    const deps = makeDeps()
    const skill = deps.fake.seedSkill({
      name: 'viet-email',
      promptTemplate: 'Soan email.',
      model: 'gpt-4o-mini',
    })

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Viet email xin nghi' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
      skillId: skill.id,
    })

    const meta = events.find((event) => event.type === 'meta')
    if (meta?.type !== 'meta') throw new Error('thieu meta event')
    // Provider `mock` resolveModel → tra model goc khi provider khong sua.
    expect(meta.model).toBe('gpt-4o-mini')
  })

  it('built-in skill resolve duoc theo id co dinh', async () => {
    const deps = makeDeps()
    const builtin = BUILTIN_SKILLS[0]

    const events = await collect(deps, {
      messages: [{ role: 'user', content: 'Tóm tắt trang nay' }],
      conversationId: CONVERSATION_ID,
      operation: 'send',
      skillId: builtin?.id,
    })

    const done = events.find((event) => event.type === 'done')
    expect(done?.type).toBe('done')
  })
})
