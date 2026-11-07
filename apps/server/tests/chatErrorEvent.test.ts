import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatEvent, ChatRequest, ProviderChunk } from '@sidekick/shared'
import { createChatStream } from '../src/services/chatService.js'
import { OpenAiCompatibleProvider } from '../src/providers/openaiCompatible.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test cho hinh thuc error event (FR-CHAT-14 / NFR-REL-02 — T-M1-19).
 *
 * - 401 → `retryable: false` (KHONG hardcode `true`).
 * - 429 → `retryAfterSeconds` present.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.3, §7.15
 */

/** Tao DB gia lap — moi lenh ghi deu thanh cong. */
function makeDb(): { insert: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn> } {
  const insert = vi.fn(() => ({
    values: () => {
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
        orderBy: () => ({ limit: async () => [] }),
        limit: async () => [],
      }),
    }),
  }))
  return { insert, select }
}

/** Tao provider gia lap voi danh sach chunk. */
function makeProvider(chunks: ProviderChunk[]): ProviderAdapter {
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
  }
}

/** Tao registry gia lap. */
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

const request: ChatRequest = {
  messages: [{ role: 'user', content: 'Xin chao' }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('chatService — error event shape (T-M1-19)', () => {
  it('401 → retryable=false (khong hardcode true)', async () => {
    const provider = makeProvider([
      { kind: 'error', errorCode: 'INVALID_API_KEY', errorMessage: 'Key sai' },
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

    expect(error).toBeDefined()
    expect(error?.type === 'error' && error.retryable).toBe(false)
    expect(error?.type === 'error' && error.code).toBe('INVALID_API_KEY')
  })

  it('429 → retryAfterSeconds duoc forward', async () => {
    const provider = makeProvider([
      {
        kind: 'error',
        errorCode: 'PROVIDER_RATE_LIMITED',
        errorMessage: 'Qua tan so',
        errorRetryable: true,
        retryAfterSeconds: 42,
      },
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

    expect(error?.type === 'error' && error.retryAfterSeconds).toBe(42)
  })

  it('loi provider → retryable=true', async () => {
    const provider = makeProvider([
      { kind: 'error', errorCode: 'PROVIDER_ERROR', errorMessage: 'Loi provider' },
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

    expect(error?.type === 'error' && error.retryable).toBe(true)
  })
})

describe('provider — Retry-After (T-M1-19)', () => {
  it('429 doc header Retry-After → retryAfterSeconds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('rate limited', {
        status: 429,
        headers: { 'Retry-After': '42' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAiCompatibleProvider({
      id: 'groq',
      name: 'Groq',
      baseUrl: 'https://api.test.local/v1',
      buildHeaders: () => ({}),
      defaultModel: 'default-model',
      preferredModels: [],
      timeoutMs: 5_000,
    })

    const chunks: ProviderChunk[] = []
    for await (const chunk of provider.stream({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      apiKey: 'k',
    })) {
      chunks.push(chunk)
    }

    const error = chunks.find((chunk) => chunk.kind === 'error')
    expect(error?.retryAfterSeconds).toBe(42)
    vi.unstubAllGlobals()
  })

  it('401 → errorRetryable=false', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAiCompatibleProvider({
      id: 'groq',
      name: 'Groq',
      baseUrl: 'https://api.test.local/v1',
      buildHeaders: () => ({}),
      defaultModel: 'default-model',
      preferredModels: [],
      timeoutMs: 5_000,
    })

    const chunks: ProviderChunk[] = []
    for await (const chunk of provider.stream({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      apiKey: 'k',
    })) {
      chunks.push(chunk)
    }

    const error = chunks.find((chunk) => chunk.kind === 'error')
    expect(error?.errorCode).toBe('INVALID_API_KEY')
    expect(error?.errorRetryable).toBe(false)
    vi.unstubAllGlobals()
  })
})
