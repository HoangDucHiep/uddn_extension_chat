import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatEvent, ChatRequest, ProviderChunk } from '@sidekick/shared'
import { createChatStream } from '../src/services/chatService.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test cho fallback chain runtime (FR-PROVIDER-04 — T-M2-02).
 *
 * Kiem chung:
 *  - Provider chinh loi tam thoi (429/5xx) → server thu provider tiep theo.
 *  - Emit SSE event `provider_switch` giua luong.
 *  - Khong fallback khi provider da stream token (tranh noi dung trung).
 *  - Khong fallback khi loi khong retryable (401).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
 */

/** Tao DB gia lap — moi lenh ghi deu thanh cong. */
function makeDb(): {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  /** Moi row duoc insert (de test kiem tra du lieu ghi). */
  inserted: Array<Record<string, unknown>>
} {
  const inserted: Array<Record<string, unknown>> = []
  const insert = vi.fn(() => ({
    values: (items: unknown) => {
      if (typeof items === 'object' && items !== null) {
        inserted.push(items as Record<string, unknown>)
      }
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
  return { insert, select, inserted }
}

/** Tao provider gia lap voi danh sach chunk. */
function makeProvider(
  id: string,
  chunks: ProviderChunk[],
  overrides: Partial<ProviderAdapter> = {},
): ProviderAdapter {
  return {
    id,
    name: id,
    requiresKey: false,
    supportsVision: () => true,
    testKey: async () => ({ ok: true }),
    listModels: async () => [`${id}-model`],
    resolveModel: (requested?: string) => requested ?? `${id}-model`,
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

/** Tao request chat toi thieu. */
function makeRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    messages: [{ role: 'user', content: 'Xin chao' }],
    ...overrides,
  }
}

/** Chunk loi tam thoi (retryable). */
function retryableError(code = 'RATE_LIMITED'): ProviderChunk {
  return {
    kind: 'error',
    errorCode: code,
    errorMessage: 'Provider tam thoi loi',
    errorRetryable: true,
  }
}

/** Chunk loi khong retryable (401). */
function authError(): ProviderChunk {
  return {
    kind: 'error',
    errorCode: 'UNAUTHORIZED',
    errorMessage: 'Sai API key',
    errorRetryable: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fallback chain runtime (FR-PROVIDER-04 — T-M2-02)', () => {
  it('chuyen sang provider du phong khi provider chinh loi tam thoi', async () => {
    const first = makeProvider('groq', [retryableError()])
    const second = makeProvider('openrouter', [
      { kind: 'token', text: 'Chao ban' },
      { kind: 'done', finishReason: 'stop' },
    ])

    const result = createChatStream(
      {
        db: makeDb() as never,
        registry: makeRegistry({ groq: first, openrouter: second }, ['groq', 'openrouter']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: false,
        logContextSnapshot: false,
      },
      makeRequest({ provider: 'groq' }),
      new AbortController().signal,
    )

    const events = await collectEvents(result.events)

    const switchEvent = events.find((event) => event.type === 'provider_switch')
    expect(switchEvent).toBeDefined()
    if (switchEvent?.type === 'provider_switch') {
      expect(switchEvent.from).toBe('groq')
      expect(switchEvent.to).toBe('openrouter')
      expect(switchEvent.reason).toBe('RATE_LIMITED')
    }

    // Token chi den tu provider du phong.
    const tokens = events.filter((event) => event.type === 'token')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.type === 'token' ? tokens[0].delta : '').toBe('Chao ban')

    // Khong co error event (fallback thanh cong).
    expect(events.some((event) => event.type === 'error')).toBe(false)

    // Event `done` van den.
    const done = events.find((event) => event.type === 'done')
    expect(done?.type === 'done' ? done.finishReason : '').toBe('stop')
  })

  it('KHONG fallback khi provider da stream token', async () => {
    const first = makeProvider('groq', [{ kind: 'token', text: 'Dau' }, retryableError()])
    const second = makeProvider('openrouter', [
      { kind: 'token', text: 'Sau' },
      { kind: 'done', finishReason: 'stop' },
    ])

    const result = createChatStream(
      {
        db: makeDb() as never,
        registry: makeRegistry({ groq: first, openrouter: second }, ['groq', 'openrouter']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: false,
        logContextSnapshot: false,
      },
      makeRequest({ provider: 'groq' }),
      new AbortController().signal,
    )

    const events = await collectEvents(result.events)

    expect(events.some((event) => event.type === 'provider_switch')).toBe(false)
    const tokens = events.filter((event) => event.type === 'token')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.type === 'token' ? tokens[0].delta : '').toBe('Dau')
    expect(events.some((event) => event.type === 'error')).toBe(true)
  })

  it('KHONG fallback khi loi khong retryable (401)', async () => {
    const first = makeProvider('groq', [authError()])
    const second = makeProvider('openrouter', [
      { kind: 'token', text: 'Chao ban' },
      { kind: 'done', finishReason: 'stop' },
    ])

    const result = createChatStream(
      {
        db: makeDb() as never,
        registry: makeRegistry({ groq: first, openrouter: second }, ['groq', 'openrouter']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: false,
        logContextSnapshot: false,
      },
      makeRequest({ provider: 'groq' }),
      new AbortController().signal,
    )

    const events = await collectEvents(result.events)

    expect(events.some((event) => event.type === 'provider_switch')).toBe(false)
    const error = events.find((event) => event.type === 'error')
    expect(error?.type === 'error' ? error.code : '').toBe('UNAUTHORIZED')
    expect(error?.type === 'error' ? error.retryable : true).toBe(false)
  })

  it('het chuoi fallback → tra loi loi cho user', async () => {
    const first = makeProvider('groq', [retryableError()])
    const second = makeProvider('openrouter', [retryableError('SERVER_ERROR')])

    const result = createChatStream(
      {
        db: makeDb() as never,
        registry: makeRegistry({ groq: first, openrouter: second }, ['groq', 'openrouter']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: false,
        logContextSnapshot: false,
      },
      makeRequest({ provider: 'groq' }),
      new AbortController().signal,
    )

    const events = await collectEvents(result.events)

    const switches = events.filter((event) => event.type === 'provider_switch')
    expect(switches).toHaveLength(1)

    const error = events.find((event) => event.type === 'error')
    expect(error?.type === 'error' ? error.code : '').toBe('SERVER_ERROR')
  })

  it('ghi `fallback_from` vao request_logs khi co fallback', async () => {
    const db = makeDb()
    const first = makeProvider('groq', [retryableError()])
    const second = makeProvider('openrouter', [
      { kind: 'token', text: 'Chao ban' },
      { kind: 'done', finishReason: 'stop' },
    ])

    const result = createChatStream(
      {
        db: db as never,
        registry: makeRegistry({ groq: first, openrouter: second }, ['groq', 'openrouter']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      makeRequest({ provider: 'groq' }),
      new AbortController().signal,
    )

    await collectEvents(result.events)

    const log = db.inserted.find((row) => row['requestId'] !== undefined) as
      | { provider?: string; fallbackFrom?: string | null }
      | undefined
    expect(log?.provider).toBe('openrouter')
    expect(log?.fallbackFrom).toBe('groq')
  })

  it('`fallback_from` la null khi khong co fallback', async () => {
    const db = makeDb()
    const only = makeProvider('mock', [
      { kind: 'token', text: 'Chao' },
      { kind: 'done', finishReason: 'stop' },
    ])

    const result = createChatStream(
      {
        db: db as never,
        registry: makeRegistry({ mock: only }, ['mock']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      makeRequest(),
      new AbortController().signal,
    )

    await collectEvents(result.events)

    const log = db.inserted.find((row) => row['requestId'] !== undefined) as
      | { fallbackFrom?: string | null }
      | undefined
    expect(log?.fallbackFrom).toBeNull()
  })

  it('provider du phong dung MODEL MAC DINH cua no (khong dung model cua provider truoc)', async () => {
    // Bug (phat hien khi chay eval that): model yeu cau (`openai/gpt-oss-120b`
    // cua Groq) duoc truyen cho **moi** provider trong chain → Gemini tra
    // `400 "unexpected model name format"` → ca luot chat that bai du da co
    // fallback.
    const usedModels: Array<{ provider: string; model: string }> = []

    const first = makeProvider('groq', [retryableError()])
    const second = makeProvider('gemini', [
      { kind: 'token', text: 'Chao ban' },
      { kind: 'done', finishReason: 'stop' },
    ])

    const result = createChatStream(
      {
        db: makeDb() as never,
        registry: makeRegistry({ groq: first, gemini: second }, ['groq', 'gemini']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: false,
        logContextSnapshot: false,
      },
      makeRequest({ provider: 'groq', model: 'openai/gpt-oss-120b' }),
      new AbortController().signal,
    )

    // Ghi lai model ma moi provider nhan.
    const spy = async function* (
      this: void,
      request: { model?: string },
    ): AsyncGenerator<ProviderChunk, void, undefined> {
      usedModels.push({ provider: 'gemini', model: request.model ?? '' })
      yield { kind: 'token', text: 'Chao ban' }
      yield { kind: 'done', finishReason: 'stop' }
    }
    second.stream = spy as ProviderAdapter['stream']

    const events = await collectEvents(result.events)

    const switchEvent = events.find((event) => event.type === 'provider_switch')
    expect(switchEvent).toBeDefined()

    // Provider du phong phai dung model mac dinh cua chinh no (`gemini-model`),
    // KHONG phai model cua Groq.
    expect(usedModels[0]?.model).toBe('gemini-model')
    expect(usedModels[0]?.model).not.toBe('openai/gpt-oss-120b')
  })

  it('user KHONG chon provider → provider dau chain van nhan model cua request', async () => {
    // Regression (phat hien sau khi fix bug tren): neu chi dua `request.provider`
    // vao dieu kien thi provider mac dinh cua he thong se **mat** model cua
    // request (skill co model → model cua skill khong con ap dung).
    const usedModels: Array<string> = []

    const first = makeProvider('mock', [
      { kind: 'token', text: 'Chao ban' },
      { kind: 'done', finishReason: 'stop' },
    ])
    const spy = async function* (
      this: void,
      request: { model?: string },
    ): AsyncGenerator<ProviderChunk, void, undefined> {
      usedModels.push(request.model ?? '')
      yield { kind: 'token', text: 'Chao ban' }
      yield { kind: 'done', finishReason: 'stop' }
    }
    first.stream = spy as ProviderAdapter['stream']

    const result = createChatStream(
      {
        db: makeDb() as never,
        registry: makeRegistry({ mock: first }, ['mock']),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: false,
        logContextSnapshot: false,
      },
      // Khong co `provider` → dung fallback chain mac dinh.
      makeRequest({ model: 'gpt-4o-mini' }),
      new AbortController().signal,
    )

    await collectEvents(result.events)

    expect(usedModels[0]).toBe('gpt-4o-mini')
  })
})
