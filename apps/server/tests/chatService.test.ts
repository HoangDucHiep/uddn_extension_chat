import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatEvent, ChatRequest, ProviderChunk } from '@sidekick/shared'
import {
  buildContextPrompt,
  buildProviderMessages,
  createChatStream,
  findLastUserIndex,
  hashText,
  mergeImages,
} from '../src/services/chatService.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test cho `chatService` — orchestrate provider + phat SSE event.
 *
 * Mock DB + registry de khong can Postgres that.
 * Docs: docs/SYSTEM_DESIGN.md §4.3
 */

/** Tao DB gia lap — moi lenh ghi deu thanh cong. */
function makeDb(): {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
} {
  // `values()` phai tra mot promise THAT (co `then` goi resolve) →
  // await trong service moi khong treo.
  const insert = vi.fn(() => ({
    values: (_items: unknown) => {
      // Resolve ra mang rong (moi `returning()` tra list row).
      const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
        onConflictDoNothing: () => Promise<unknown[]>
        returning: (columns?: unknown) => Promise<unknown[]>
      }
      promise.onConflictDoNothing = () => Promise.resolve([])
      promise.returning = (_columns?: unknown) => Promise.resolve([])
      return promise
    },
  }))
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => [],
        }),
        limit: async () => [],
      }),
    }),
  }))
  return { insert, select }
}

/** Tao provider gia lap voi danh sach chunk. */
function makeProvider(chunks: ProviderChunk[], overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    id: 'mock',
    name: 'Mock',
    requiresKey: false,
    supportsVision: () => true,
    testKey: async () => ({ ok: true }),
    listModels: async () => ['mock-model'],
    resolveModel: (requested?: string) => requested ?? 'mock-model',
    async *stream() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
    ...overrides,
  }
}

/** Tao registry gia lap voi danh sach provider. */
function makeRegistry(providers: Record<string, ProviderAdapter>, chain: string[]): ProviderRegistry {
  return {
    get: (id: string) => providers[id],
    require: (id: string) => {
      const provider = providers[id]
      if (provider === undefined) throw new Error(`Khong tim thay provider "${id}"`)
      return provider
    },
    list: () => Object.values(providers),
    getFallbackChain: () => chain as never,
    getFallbacks: () => chain.slice(1) as never,
  } as unknown as ProviderRegistry
}

/** Thu thap tat ca event tu generator. */
async function collectEvents(
  generator: AsyncGenerator<ChatEvent, void, undefined>,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of generator) {
    events.push(event)
  }
  return events
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildProviderMessages', () => {
  it('luon co system prompt o dau', () => {
    const messages = buildProviderMessages({
      messages: [{ role: 'user', content: 'Xin chao' }],
    })

    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content.length).toBeGreaterThan(0)
  })

  it('them context vao cuoi, gan ro rang la du lieu', () => {
    const messages = buildProviderMessages({
      messages: [{ role: 'user', content: 'Xin chao' }],
      context: {
        items: [
          {
            id: 'tab-1',
            kind: 'tab',
            tier: 'attachment',
            title: 'Bai viet',
            url: 'https://example.com/bai-viet',
            text: 'Noi dung bai viet.',
          },
        ],
      },
    })

    const last = messages[messages.length - 1]
    expect(last?.role).toBe('user')
    expect(last?.content).toContain('Bai viet')
    expect(last?.content).toContain('Noi dung bai viet.')
    expect(last?.content).toContain('https://example.com/bai-viet')
  })

  it('KHONG them context khi khong co item', () => {
    const messages = buildProviderMessages({
      messages: [{ role: 'user', content: 'Xin chao' }],
    })

    expect(messages).toHaveLength(2)
    expect(messages.some((message) => message.content.includes('đính kèm'))).toBe(false)
  })

  it('system prompt tuy chinh duoc dung thay the mac dinh', () => {
    const messages = buildProviderMessages({
      messages: [{ role: 'user', content: 'Xin chao' }],
      systemPrompt: 'Ban la tro ly rieng.',
    })

    expect(messages[0]?.content).toBe('Ban la tro ly rieng.')
  })
})

describe('buildContextPrompt', () => {
  it('sap xep item theo tier uu tien', () => {
    const prompt = buildContextPrompt({
      items: [
        { id: 'a', kind: 'tab', tier: 'currentTab', title: 'Trang hien tai' },
        { id: 'b', kind: 'tab', tier: 'selection', title: 'Doan boi den' },
        { id: 'c', kind: 'tab', tier: 'attachment', title: 'Tab dinh kem' },
      ],
    })

    expect(prompt.indexOf('Doan boi den')).toBeLessThan(prompt.indexOf('Tab dinh kem'))
    expect(prompt.indexOf('Tab dinh kem')).toBeLessThan(prompt.indexOf('Trang hien tai'))
  })

  it('nhan ro nguon theo loai item', () => {
    const prompt = buildContextPrompt({
      items: [
        { id: 'a', kind: 'tab', tier: 'currentTab', title: 'T' },
        { id: 'b', kind: 'file', tier: 'attachment', title: 'F' },
        { id: 'c', kind: 'selection', tier: 'selection', title: 'S' },
      ],
    })

    expect(prompt).toContain('[Trang hiện tại]')
    expect(prompt).toContain('[File đính kèm]')
    expect(prompt).toContain('[Đã bôi đen]')
  })
})

describe('vision — buildProviderMessages (FR-VISION-01)', () => {
  const image = { mimeType: 'image/png' as const, data: 'aGVsbG8=' }

  it('gan anh vao user turn cuoi cung', () => {
    const messages = buildProviderMessages(
      { messages: [{ role: 'user', content: 'Mo ta anh nay' }] },
      { images: [image] },
    )

    const lastIndex = findLastUserIndex(messages)
    expect(lastIndex).toBeGreaterThan(0)
    expect(messages[lastIndex]?.attachments).toEqual([image])
  })

  it('khong co anh → khong turn nao co attachments', () => {
    const messages = buildProviderMessages({
      messages: [{ role: 'user', content: 'Xin chao' }],
    })

    expect(messages.some((message) => message.attachments !== undefined)).toBe(false)
  })

  it('anh duoc gan vao turn user cuoi, khong phai turn system', () => {
    const messages = buildProviderMessages(
      {
        messages: [
          { role: 'user', content: 'Cau 1' },
          { role: 'assistant', content: 'Tra loi 1' },
          { role: 'user', content: 'Cau 2' },
        ],
      },
      { images: [image] },
    )

    expect(messages[0]?.attachments).toBeUndefined()
    const lastIndex = findLastUserIndex(messages)
    expect(messages[lastIndex]?.content).toBe('Cau 2')
    expect(messages[lastIndex]?.attachments).toHaveLength(1)
  })

  it('token anh bi truoc khoi ngan sach lich su', () => {
    // mock context window = 8000, margin 2000, reserved output 2048
    // → historyBudget ≈ 3952 token. Moi turn 400 ky tu ≈ 100 token.
    // 50 turn ≈ 5000 token > budget → co cat; anh ton 258 token → cat them.
    const manyTurns = Array.from({ length: 50 }, () => ({
      role: 'user' as const,
      content: 'x'.repeat(400),
    }))

    const withoutImage = buildProviderMessages({ messages: manyTurns })
    const withImage = buildProviderMessages({ messages: manyTurns }, { images: [image] })

    expect(withoutImage.length).toBeLessThan(manyTurns.length + 2)
    expect(withImage.length).toBeLessThan(withoutImage.length)
  })
})

describe('vision — mergeImages', () => {
  const attachment = {
    id: '11111111-2222-4333-8444-555555555555',
    mimeType: 'image/png' as const,
    data: 'AAAA',
    bytes: 3,
  }

  it('anh cua request duoc uu tien truoc', () => {
    const merged = mergeImages([{ mimeType: 'image/jpeg', data: 'BBBB' }], [attachment])
    expect(merged[0]).toEqual({ mimeType: 'image/png', data: 'AAAA' })
  })

  it('hop nhat anh cua conversation vao sau', () => {
    const merged = mergeImages([{ mimeType: 'image/jpeg', data: 'BBBB' }], [attachment])
    expect(merged).toHaveLength(2)
    expect(merged[1]).toEqual({ mimeType: 'image/jpeg', data: 'BBBB' })
  })

  it('khong trung lap khi anh da co trong DB', () => {
    const merged = mergeImages([{ mimeType: 'image/png', data: 'AAAA' }], [attachment])
    expect(merged).toHaveLength(1)
  })

  it('gioi han so anh toi da', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      mimeType: 'image/png' as const,
      data: `DATA${index}`,
    }))
    const merged = mergeImages(many, [])
    expect(merged.length).toBeLessThanOrEqual(4)
  })
})

describe('hashText', () => {  it('cung noi dung → cung hash', () => {
    expect(hashText('abc')).toBe(hashText('abc'))
  })

  it('noi dung khac → hash khac', () => {
    expect(hashText('abc')).not.toBe(hashText('abd'))
  })
})

describe('createChatStream', () => {
  const request: ChatRequest = {
    messages: [{ role: 'user', content: 'Xin chao' }],
  }

  it('yield meta → token → done theo thu tu', async () => {
    const provider = makeProvider([
      { kind: 'token', text: 'Xin ' },
      { kind: 'token', text: 'chao' },
      { kind: 'done', finishReason: 'stop' },
    ])
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ mock: provider }, ['mock']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    expect(events[0]?.type).toBe('meta')
    expect(events[events.length - 1]?.type).toBe('done')
    const tokens = events.filter((event) => event.type === 'token')
    expect(tokens).toHaveLength(2)
  })

  it('yield usage khi provider tra usage', async () => {
    const provider = makeProvider([
      { kind: 'token', text: 'ok' },
      { kind: 'usage', tokensIn: 10, tokensOut: 4 },
      { kind: 'done', finishReason: 'stop' },
    ])
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ mock: provider }, ['mock']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    const usage = events.find((event) => event.type === 'usage')
    expect(usage).toMatchObject({ type: 'usage', tokensIn: 10, tokensOut: 4 })
  })

  it('provider tra error → yield error event + done finishReason error', async () => {
    const provider = makeProvider([
      { kind: 'error', errorCode: 'PROVIDER_ERROR', errorMessage: 'Het credit' },
    ])
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ mock: provider }, ['mock']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    const error = events.find((event) => event.type === 'error')
    expect(error).toMatchObject({ type: 'error', code: 'PROVIDER_ERROR', message: 'Het credit' })
    const done = events[events.length - 1]
    expect(done).toMatchObject({ type: 'done', finishReason: 'error' })
  })

  it('khong co provider nao trong chain → yield MISSING_API_KEY', async () => {
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({}, ['mock']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    const error = events.find((event) => event.type === 'error')
    expect(error).toMatchObject({ type: 'error', code: 'MISSING_API_KEY' })
    expect(events[events.length - 1]).toMatchObject({ type: 'done', finishReason: 'error' })
  })

  it('fallback sang provider tiep theo khi provider dau khong co key', async () => {
    // `gemini` khong co key → `resolveKey` nem loi → service thu provider tiep.
    const gemini = makeProvider([{ kind: 'token', text: 'sai' }], {
      id: 'gemini',
      requiresKey: true,
    })
    const groq = makeProvider([{ kind: 'token', text: 'ok' }], {
      id: 'groq',
      requiresKey: true,
    })
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ gemini, groq }, ['gemini', 'groq']),
      envKeys: { groq: 'env-key-groq' },
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    const meta = events.find((event) => event.type === 'meta')
    expect(meta).toMatchObject({ type: 'meta', provider: 'groq', keySource: 'K1' })
  })

  it('request.provider duoc dat DAU chuoi nhung fallback chain van con', async () => {
    // FR-PROVIDER-04: provider user chon phai duoc uu tien, NHUNG fallback
    // chain khong duoc mat (truoc day `request.provider` thay the chain →
    // mat co che fallback).
    const groq = makeProvider([{ kind: 'token', text: 'sai' }], {
      id: 'groq',
      requiresKey: true,
    })
    const gemini = makeProvider([{ kind: 'token', text: 'ok' }], {
      id: 'gemini',
      requiresKey: true,
    })
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ groq, gemini }, ['gemini']),
      envKeys: { gemini: 'env-key-gemini' },
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(
      deps,
      { ...request, provider: 'groq' },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    // `groq` khong co key → phai fallback sang `gemini` (fallback chain).
    const meta = events.find((event) => event.type === 'meta')
    expect(meta).toMatchObject({ type: 'meta', provider: 'gemini', keySource: 'K1' })
  })

  it('request.provider khi co key → duoc dung truoc fallback chain', async () => {
    const groq = makeProvider([{ kind: 'token', text: 'ok' }], {
      id: 'groq',
      requiresKey: true,
    })
    const gemini = makeProvider([{ kind: 'token', text: 'sai' }], {
      id: 'gemini',
      requiresKey: true,
    })
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ groq, gemini }, ['gemini']),
      envKeys: { groq: 'env-key-groq', gemini: 'env-key-gemini' },
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(
      deps,
      { ...request, provider: 'groq' },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const meta = events.find((event) => event.type === 'meta')
    expect(meta).toMatchObject({ type: 'meta', provider: 'groq' })
  })

  it('request co anh → bo qua provider khong ho tro vision', async () => {
    const blind = makeProvider([{ kind: 'token', text: 'sai' }], {
      id: 'groq',
      requiresKey: false,
      supportsVision: () => false,
    })
    const vision = makeProvider([{ kind: 'token', text: 'ok' }], {
      id: 'gemini',
      requiresKey: false,
      supportsVision: () => true,
    })
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ groq: blind, gemini: vision }, ['groq', 'gemini']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(
      deps,
      {
        messages: [
          {
            role: 'user',
            content: 'Mo ta',
            attachments: [
              {
                id: '11111111-2222-4333-8444-555555555555',
                mimeType: 'image/png',
                data: 'aGVsbG8=',
                bytes: 5,
              },
            ],
          },
        ],
      },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const meta = events.find((event) => event.type === 'meta')
    expect(meta).toMatchObject({ type: 'meta', provider: 'gemini' })
  })

  it('request co anh + khong provider nao ho tro → PROVIDER_VISION_UNSUPPORTED', async () => {
    const blind = makeProvider([{ kind: 'token', text: 'sai' }], {
      id: 'groq',
      requiresKey: false,
      supportsVision: () => false,
    })
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ groq: blind }, ['groq']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(
      deps,
      {
        messages: [
          {
            role: 'user',
            content: 'Mo ta',
            attachments: [
              {
                id: '11111111-2222-4333-8444-555555555555',
                mimeType: 'image/png',
                data: 'aGVsbG8=',
                bytes: 5,
              },
            ],
          },
        ],
      },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const error = events.find((event) => event.type === 'error')
    expect(error).toMatchObject({ type: 'error', code: 'PROVIDER_VISION_UNSUPPORTED' })
  })

  it('request KHONG co anh → provider khong vision van duoc dung', async () => {
    const blind = makeProvider([{ kind: 'token', text: 'ok' }], {
      id: 'groq',
      requiresKey: false,
      supportsVision: () => false,
    })
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ groq: blind }, ['groq']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    const meta = events.find((event) => event.type === 'meta')
    expect(meta).toMatchObject({ type: 'meta', provider: 'groq' })
  })

  it('abort signal → finishReason aborted', async () => {    const controller = new AbortController()
    const provider = makeProvider([
      { kind: 'token', text: 'a' },
      { kind: 'token', text: 'b' },
      { kind: 'done', finishReason: 'stop' },
    ])
    const deps = {
      db: makeDb() as never,
      registry: makeRegistry({ mock: provider }, ['mock']),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    }

    controller.abort()
    const result = createChatStream(deps, request, controller.signal)
    const events = await collectEvents(result.events)

    const done = events[events.length - 1]
    expect(done).toMatchObject({ type: 'done', finishReason: 'aborted' })
  })
})
