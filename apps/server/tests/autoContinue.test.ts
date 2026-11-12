import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OUTPUT_LIMITS, type ChatEvent, type ProviderChunk } from '@sidekick/shared'
import { createChatStream } from '../src/services/chatService.js'
import { buildContinuationMessages, shouldAutoContinue } from '../src/services/autoContinue.js'
import { effectiveMaxOutputTokens, hasBudgetRoom } from '../src/services/outputTokens.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test co che tu noi tiep cau tra loi khi model bi cat boi gioi han token
 * (FR-CHAT-15 — T-M2-24).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.30
 */

/** Tao DB gia lap — giu lai cac row da insert de assert `meta.aborted`. */
function makeDb(): {
  insert: ReturnType<typeof vi.fn>
  select: ReturnType<typeof vi.fn>
  inserted: Array<Record<string, unknown>>
} {
  const inserted: Array<Record<string, unknown>> = []
  const insert = vi.fn(() => ({
    values: (items: unknown) => {
      if (Array.isArray(items)) {
        for (const item of items) inserted.push(item as Record<string, unknown>)
      } else {
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
        orderBy: () => ({
          limit: async () => [],
        }),
        limit: async () => [],
      }),
    }),
  }))
  return { insert, select, inserted }
}

/**
 * Tao provider gia lap — **moi lan goi `stream()`** tra 1 danh sach chunk.
 *
 * @param rounds - Danh sach chunk theo tung lan goi `stream()`.
 */
function makeProvider(rounds: ProviderChunk[][]): ProviderAdapter {
  let callIndex = 0
  return {
    id: 'mock',
    name: 'Mock',
    requiresKey: false,
    supportsVision: () => true,
    testKey: async () => ({ ok: true }),
    listModels: async () => ['mock-model'],
    resolveModel: (requested?: string) => requested ?? 'mock-model',
    async *stream() {
      const chunks = rounds[Math.min(callIndex, rounds.length - 1)] ?? []
      callIndex += 1
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

/** Deps gia lap cho `createChatStream`. */
function makeDeps(provider: ProviderAdapter, db: ReturnType<typeof makeDb>) {
  return {
    db: db as never,
    registry: makeRegistry(provider),
    envKeys: {},
    masterKey: undefined,
    logFullContent: false,
    logRequests: false,
    logContextSnapshot: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('shouldAutoContinue', () => {
  const base = {
    finishReason: 'length' as const,
    autoContinueRounds: 0,
    budgetOk: true,
    maxRounds: OUTPUT_LIMITS.MAX_AUTO_CONTINUE_ROUNDS,
  }

  it('model bi cat (length) + con vong → tiep tuc', () => {
    expect(shouldAutoContinue(base)).toBe(true)
  })

  it('model ket thuc binh thuong → KHONG tiep tuc', () => {
    expect(shouldAutoContinue({ ...base, finishReason: 'stop' })).toBe(false)
  })

  it('het so vong → KHONG tiep tuc', () => {
    expect(
      shouldAutoContinue({ ...base, autoContinueRounds: base.maxRounds }),
    ).toBe(false)
  })

  it('het budget → KHONG tiep tuc', () => {
    expect(shouldAutoContinue({ ...base, budgetOk: false })).toBe(false)
  })

  it('gioi han toi da la 3 vong', () => {
    expect(OUTPUT_LIMITS.MAX_AUTO_CONTINUE_ROUNDS).toBe(3)
  })
})

describe('buildContinuationMessages', () => {
  it('tao 2 message: assistant (partial) roi user (chi dan tiep)', () => {
    const messages = buildContinuationMessages('Da viet mot phan')

    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ role: 'assistant', content: 'Da viet mot phan' })
    expect(messages[1]?.role).toBe('user')
    expect(messages[1]?.content.length).toBeGreaterThan(0)
  })

  it('chi dan KHONG nói "bi ngat" → model khong viet loi giai thich (FR-CHAT-15)', () => {
    const messages = buildContinuationMessages('Da viet mot phan')
    const instruction = messages[1]?.content ?? ''

    // `CONTINUE_INSTRUCTION` (dung cho nut "Tiep tuc" tay) co "bi ngat" →
    // model tu viet "do bi gioi han hien thi" → phai tach rieng.
    expect(instruction).not.toContain('bi ngat')
    expect(instruction).not.toContain('CONTINUE_INSTRUCTION')
    expect(instruction).toContain('Tiep tuc viet phan con lai')
  })
})

describe('effectiveMaxOutputTokens', () => {
  it('mac dinh la 8192', () => {
    expect(effectiveMaxOutputTokens('gemini')).toBe(8_192)
  })

  it('clamp theo tran cua provider', () => {
    expect(effectiveMaxOutputTokens('mock', 100_000)).toBe(4_096)
  })
})

describe('hasBudgetRoom', () => {
  it('budget tat → luon con cho', () => {
    expect(hasBudgetRoom(false, 0, 0)).toBe(true)
  })

  it('chua vuot han muc → con cho', () => {
    expect(hasBudgetRoom(true, 10, 5)).toBe(true)
  })

  it('da vuot han muc → het cho', () => {
    expect(hasBudgetRoom(true, 10, 12)).toBe(false)
  })
})

describe('createChatStream — auto-continue (FR-CHAT-15)', () => {
  const request = {
    messages: [{ role: 'user' as const, content: 'Viet mot bai dai' }],
  }

  it('model bi cat 1 lan → server tu stream lai, chi 1 event done', async () => {
    const provider = makeProvider([
      [
        { kind: 'token', text: 'Phan mot' },
        { kind: 'usage', tokensIn: 10, tokensOut: 20 },
        { kind: 'done', finishReason: 'length' },
      ],
      [
        { kind: 'token', text: 'Phan hai' },
        { kind: 'usage', tokensIn: 10, tokensOut: 30 },
        { kind: 'done', finishReason: 'stop' },
      ],
    ])
    const db = makeDb()

    const result = createChatStream(
      makeDeps(provider, db),
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    // Chi co **1** event `done` (client khong phai can thiep gi).
    const dones = events.filter((event) => event.type === 'done')
    expect(dones).toHaveLength(1)
    expect(dones[0]).toMatchObject({ type: 'done', finishReason: 'stop' })

    // Token cua ca 2 vong deu duoc stream cho client.
    const tokens = events.filter((event) => event.type === 'token')
    expect(tokens).toHaveLength(2)

    // Token duoc **cong don** qua cac vong (khong ghi de).
    const usage = events.find((event) => event.type === 'usage')
    expect(usage).toMatchObject({ type: 'usage', tokensIn: 20, tokensOut: 50 })
  })

  it('model bi cat lien tuc → dung sau MAX_AUTO_CONTINUE_ROUNDS, done = length', async () => {
    // Luon tra `length` → het vong auto-continue.
    const provider = makeProvider([
      [{ kind: 'token', text: 'A' }, { kind: 'done', finishReason: 'length' }],
      [{ kind: 'token', text: 'B' }, { kind: 'done', finishReason: 'length' }],
      [{ kind: 'token', text: 'C' }, { kind: 'done', finishReason: 'length' }],
      [{ kind: 'token', text: 'D' }, { kind: 'done', finishReason: 'length' }],
      [{ kind: 'token', text: 'E' }, { kind: 'done', finishReason: 'length' }],
    ])
    const db = makeDb()

    const result = createChatStream(
      makeDeps(provider, db),
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const dones = events.filter((event) => event.type === 'done')
    expect(dones).toHaveLength(1)
    expect(dones[0]).toMatchObject({ type: 'done', finishReason: 'length' })

    // Vong 0 + 3 vong auto-continue = 4 phan text.
    const tokens = events.filter((event) => event.type === 'token')
    expect(tokens).toHaveLength(4)

    // Message luu DB phai danh dau `aborted` → UI hien thi nut "Tiep tuc".
    const assistant = db.inserted.find(
      (row) => row['role'] === 'assistant',
    )
    const meta = assistant?.['meta'] as { aborted?: boolean } | undefined
    expect(meta?.aborted).toBe(true)
  })

  it('model cat → noi tiep duoc, text cuoi gop ca 2 phan', async () => {
    const provider = makeProvider([
      [{ kind: 'token', text: 'Dau' }, { kind: 'done', finishReason: 'length' }],
      [{ kind: 'token', text: 'Sau' }, { kind: 'done', finishReason: 'stop' }],
    ])
    const db = makeDb()

    const result = createChatStream(
      makeDeps(provider, db),
      request,
      new AbortController().signal,
    )
    await collectEvents(result.events)

    const assistant = db.inserted.find((row) => row['role'] === 'assistant')
    expect(assistant?.['content']).toBe('DauSau')
  })

  it('model cat → khong ton 1 vong tool (toolRound khong tăng)', async () => {
    // Provider goi tool 1 lan → vong tiep theo model bi cat → auto-continue.
    const provider = makeProvider([
      [
        { kind: 'tool_call', toolCallId: 'call-1', name: 'calculator', args: {} },
        { kind: 'done', finishReason: 'tool' },
      ],
      [{ kind: 'token', text: 'Dau' }, { kind: 'done', finishReason: 'length' }],
      [{ kind: 'token', text: 'Sau' }, { kind: 'done', finishReason: 'stop' }],
    ])
    const db = makeDb()

    const result = createChatStream(
      makeDeps(provider, db),
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    const dones = events.filter((event) => event.type === 'done')
    expect(dones).toHaveLength(1)
    expect(dones[0]).toMatchObject({ type: 'done', finishReason: 'stop' })
  })

  it('maxOutputTokens gui len provider da clamp theo provider', async () => {
    let receivedMax: number | undefined
    const provider: ProviderAdapter = {
      id: 'mock',
      name: 'Mock',
      requiresKey: false,
      supportsVision: () => true,
      testKey: async () => ({ ok: true }),
      listModels: async () => ['mock-model'],
      resolveModel: (requested?: string) => requested ?? 'mock-model',
      async *stream(request2) {
        receivedMax = request2.maxOutputTokens
        yield { kind: 'token', text: 'ok' }
        yield { kind: 'done', finishReason: 'stop' }
      },
    }
    const db = makeDb()

    const result = createChatStream(
      makeDeps(provider, db),
      { ...request, maxOutputTokens: 100_000 },
      new AbortController().signal,
    )
    await collectEvents(result.events)

    expect(receivedMax).toBe(4_096)
  })
})
