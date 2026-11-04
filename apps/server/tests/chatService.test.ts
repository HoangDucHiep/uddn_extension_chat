import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatEvent, ChatRequest, ProviderChunk } from '@sidekick/shared'
import {
  buildContextPrompt,
  buildProviderMessages,
  createChatStream,
  hashText,
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
      const promise = Promise.resolve(undefined) as Promise<undefined> & {
        onConflictDoNothing: () => Promise<undefined>
      }
      promise.onConflictDoNothing = () => Promise.resolve(undefined)
      return promise
    },
  }))
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        orderBy: () => ({
          limit: async () => [],
        }),
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

describe('hashText', () => {
  it('cung noi dung → cung hash', () => {
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
    }

    const result = createChatStream(deps, request, new AbortController().signal)
    const events = await collectEvents(result.events)

    const meta = events.find((event) => event.type === 'meta')
    expect(meta).toMatchObject({ type: 'meta', provider: 'groq', keySource: 'K1' })
  })

  it('abort signal → finishReason aborted', async () => {
    const controller = new AbortController()
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
    }

    controller.abort()
    const result = createChatStream(deps, request, controller.signal)
    const events = await collectEvents(result.events)

    const done = events[events.length - 1]
    expect(done).toMatchObject({ type: 'done', finishReason: 'aborted' })
  })
})
