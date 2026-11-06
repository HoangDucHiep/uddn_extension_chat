import { describe, expect, it, vi } from 'vitest'
import type { ChatEvent, ProviderChunk } from '@sidekick/shared'
import { createChatStream } from '../src/services/chatService.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test SSE event `citation` trong chat stream (FR-CONTEXT-10 — T-M1-08).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

/** DB gia lap — ghi nhan cac bang duoc insert. */
function makeDb(): {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  inserted: () => unknown[]
} {
  const insertedRows: unknown[] = []

  const insert = vi.fn((table: unknown) => ({
    values: (items: unknown) => {
      insertedRows.push({ table, items })
      const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
        onConflictDoNothing: () => Promise<unknown[]>
        returning: (columns?: unknown) => Promise<unknown[]>
      }
      promise.onConflictDoNothing = () => Promise.resolve([])
      promise.returning = () => Promise.resolve([])
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

  return { insert, select, inserted: () => insertedRows }
}

/** Provider gia lap — tra danh sach chunk da cho. */
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

/** Registry gia lap. */
function makeRegistry(provider: ProviderAdapter): ProviderRegistry {
  return {
    get: () => provider,
    require: () => provider,
    list: () => [provider],
    getFallbackChain: () => ['mock'] as never,
    getFallbacks: () => [] as never,
  } as unknown as ProviderRegistry
}

/** Thu thap tat ca event. */
async function collectEvents(
  generator: AsyncGenerator<ChatEvent, void, undefined>,
): Promise<ChatEvent[]> {
  const events: ChatEvent[] = []
  for await (const event of generator) {
    events.push(event)
  }
  return events
}

/** Tao deps cho `createChatStream`. */
function makeDeps(provider: ProviderAdapter, db = makeDb()): {
  deps: Parameters<typeof createChatStream>[0]
  db: ReturnType<typeof makeDb>
} {
  return {
    deps: {
      db: db as never,
      registry: makeRegistry(provider),
      envKeys: {},
      masterKey: undefined,
      logFullContent: false,
      logRequests: false,
      logContextSnapshot: false,
    },
    db,
  }
}

describe('createChatStream — citation event', () => {
  it('phat event citation cho nguon duoc trich dan', async () => {
    const provider = makeProvider([{ kind: 'token', text: 'Gia do la 30% [1].' }])
    const { deps } = makeDeps(provider)

    const result = createChatStream(
      deps,
      {
        messages: [{ role: 'user', content: 'Hoi ve trang' }],
        context: {
          items: [
            {
              id: 'tab-1',
              kind: 'tab',
              tier: 'attachment',
              url: 'https://example.com/bai-viet',
              title: 'Bai viet',
              excerpt: 'Doan trich dan ngan.',
            },
          ],
        },
      },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const citation = events.find((event) => event.type === 'citation')
    expect(citation).toMatchObject({
      type: 'citation',
      index: 1,
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      snippet: 'Doan trich dan ngan.',
    })
  })

  it('citation den TRUOC event done', async () => {
    const provider = makeProvider([{ kind: 'token', text: 'x [1]' }])
    const { deps } = makeDeps(provider)

    const result = createChatStream(
      deps,
      {
        messages: [{ role: 'user', content: 'Hoi ve trang' }],
        context: {
          items: [{ id: 'tab-1', kind: 'tab', tier: 'attachment', title: 'Bai viet' }],
        },
      },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const citationIndex = events.findIndex((event) => event.type === 'citation')
    const doneIndex = events.findIndex((event) => event.type === 'done')
    expect(citationIndex).toBeGreaterThan(-1)
    expect(citationIndex).toBeLessThan(doneIndex)
  })

  it('khong co context → khong phat event citation', async () => {
    const provider = makeProvider([{ kind: 'token', text: 'Gia do la 30% [1].' }])
    const { deps } = makeDeps(provider)

    const result = createChatStream(
      deps,
      { messages: [{ role: 'user', content: 'Hoi chung' }] },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    expect(events.some((event) => event.type === 'citation')).toBe(false)
  })

  it('LLM khong trich dan gi → khong phat event citation', async () => {
    const provider = makeProvider([{ kind: 'token', text: 'Khong trich dan gi ca.' }])
    const { deps } = makeDeps(provider)

    const result = createChatStream(
      deps,
      {
        messages: [{ role: 'user', content: 'Hoi ve trang' }],
        context: {
          items: [{ id: 'tab-1', kind: 'tab', tier: 'attachment', title: 'Bai viet' }],
        },
      },
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    expect(events.some((event) => event.type === 'citation')).toBe(false)
  })

  it('ghi citation vao bang citations', async () => {
    const provider = makeProvider([{ kind: 'token', text: 'x [1]' }])
    const { deps, db } = makeDeps(provider)

    const result = createChatStream(
      deps,
      {
        messages: [{ role: 'user', content: 'Hoi ve trang' }],
        context: {
          items: [
            {
              id: 'tab-1',
              kind: 'tab',
              tier: 'attachment',
              url: 'https://example.com/bai-viet',
              title: 'Bai viet',
              excerpt: 'Doan trich dan ngan.',
            },
          ],
        },
      },
      new AbortController().signal,
    )
    await collectEvents(result.events)

    const citationInsert = db.inserted().find((row) => {
      const record = row as { items?: unknown[] }
      return Array.isArray(record.items) && record.items.length > 0
    })
    expect(citationInsert).toBeDefined()

    const items = (citationInsert as { items: unknown[] }).items
    expect(items[0]).toMatchObject({
      idx: 1,
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
    })
  })
})
