import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ChatEvent, ChatRequest, ProviderChunk } from '@sidekick/shared'
import { hashContextItems, hashString } from '@sidekick/shared'
import { createChatStream } from '../src/services/chatService.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test cho `request_logs.context_hash` + `context_snapshot` (T-M1-06).
 *
 * AC goc cua T-M1-06: "Log `request_logs.context_hash` khop voi context da gui".
 * →
 *  - `context_hash` phai la hash cua CONTEXT (khong phai hash cua prompt).
 *  - `context_snapshot` chi duoc ghi khi bat setting.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.2, §7.3.5
 */

/** Gia tri insert da ghi vao DB (de assert). */
interface InsertedRow {
  requestId: string
  contextHash: string | null
  contextSnapshot: unknown
  promptText: string | null
  responseText: string | null
}

/** Tao DB gia lap — giu lai cac dong da insert. */
function makeDb(): {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  rows: InsertedRow[]
} {
  const rows: InsertedRow[] = []

  const insert = vi.fn(() => ({
    values: (items: unknown) => {
      const record = items as Partial<InsertedRow>
      rows.push({
        requestId: record.requestId ?? '',
        contextHash: record.contextHash ?? null,
        contextSnapshot: record.contextSnapshot ?? null,
        promptText: record.promptText ?? null,
        responseText: record.responseText ?? null,
      })

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

  return { insert, select, rows }
}

/** Tao provider gia lap. */
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

const contextItem = {
  id: 'tab-1',
  kind: 'tab' as const,
  tier: 'attachment' as const,
  url: 'https://example.com/bai-viet',
  title: 'Bai viet',
  text: 'Noi dung chinh cua trang.',
}

beforeEach(() => {
  vi.clearAllMocks()
})

/** Chay 1 luot chat voi context cho truoc va tra ve dong log da ghi. */
async function runWithContext(
  request: ChatRequest,
  options: { logContextSnapshot: boolean },
): Promise<InsertedRow> {
  const db = makeDb()
  const provider = makeProvider([
    { kind: 'token', text: 'ok' },
    { kind: 'done', finishReason: 'stop' },
  ])

  const deps = {
    db: db as never,
    registry: makeRegistry(provider),
    envKeys: {},
    masterKey: undefined,
    logFullContent: false,
    logRequests: true,
    logContextSnapshot: options.logContextSnapshot,
  }

  const result = createChatStream(deps, request, new AbortController().signal)
  await collectEvents(result.events)

  const row = db.rows[db.rows.length - 1]
  if (row === undefined) throw new Error('Khong co dong request_logs nao duoc ghi')
  return row
}

describe('request_logs.context_hash (T-M1-06)', () => {
  it('context_hash = hash cua context da gui (khong phai hash cua prompt)', async () => {
    const row = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Sau doi la gi?' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )

    // Tinh hash bang chinh ham dung chung, tren item **da cat ngan sach**
    // (item client gui ra duoi day da nho hon gioi han → khong bi cat).
    const expected = hashContextItems([contextItem])
    expect(row.contextHash).toBe(expected)
  })

  it('hash khac voi hash cua toan bo prompt', async () => {
    const row = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Sau doi la gi?' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )

    // Hash cua prompt se bao gom system prompt + lich su → phai khac.
    expect(row.contextHash).not.toBe(hashString('Sau doi la gi?'))
  })

  it('doi cau hoi → context_hash KHONG doi (chi context moi quan trong)', async () => {
    const first = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi 1' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )

    const second = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi 2' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )

    expect(second.contextHash).toBe(first.contextHash)
  })

  it('doi noi dung context → context_hash DOI', async () => {
    const first = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )

    const second = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi' }],
        context: {
          items: [{ ...contextItem, text: 'Noi dung da thay doi.' }],
        },
      },
      { logContextSnapshot: false },
    )

    expect(second.contextHash).not.toBe(first.contextHash)
  })

  it('khong co context → context_hash = null', async () => {
    const row = await runWithContext(
      { messages: [{ role: 'user', content: 'Xin chao' }] },
      { logContextSnapshot: false },
    )

    expect(row.contextHash).toBeNull()
  })

  it('context_hash phai la hash cua ban DA CAT (server la nguon chan su that)', async () => {
    // Client gui 200k ky tu; provider `mock` chi co context window 32k →
    // server cat phan dau → context_hash phai bam phan DA CAT.
    const big = {
      id: 'big',
      kind: 'tab' as const,
      tier: 'attachment' as const,
      title: 'Trang lon',
      text: 'x'.repeat(200_000),
    }

    const row = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Tom tat' }],
        context: { items: [big] },
      },
      { logContextSnapshot: false },
    )

    const fullHash = hashContextItems([big])
    expect(row.contextHash).not.toBe(fullHash)
    expect(row.contextHash).not.toBeNull()
  })
})

describe('request_logs.context_snapshot (T-M1-06)', () => {
  it('mac dinh TAT → context_snapshot = null', async () => {
    const row = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )

    expect(row.contextSnapshot).toBeNull()
  })

  it('bat → context_snapshot chua id/url/title/text', async () => {
    const row = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: true },
    )

    expect(Array.isArray(row.contextSnapshot)).toBe(true)
    const snapshot = row.contextSnapshot as Array<Record<string, unknown>>
    expect(snapshot[0]?.['id']).toBe('tab-1')
    expect(snapshot[0]?.['url']).toBe('https://example.com/bai-viet')
    expect(snapshot[0]?.['title']).toBe('Bai viet')
    expect(snapshot[0]?.['text']).toBe('Noi dung chinh cua trang.')
  })

  it('khong co context → context_snapshot = null (ke khi bat)', async () => {
    const row = await runWithContext(
      { messages: [{ role: 'user', content: 'Xin chao' }] },
      { logContextSnapshot: true },
    )

    expect(row.contextSnapshot).toBeNull()
  })

  it('context_snapshot khong lam thay doi context_hash', async () => {
    const off = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: false },
    )
    const on = await runWithContext(
      {
        messages: [{ role: 'user', content: 'Cau hoi' }],
        context: { items: [contextItem] },
      },
      { logContextSnapshot: true },
    )

    expect(on.contextHash).toBe(off.contextHash)
  })
})
