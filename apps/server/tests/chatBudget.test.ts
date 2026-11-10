import { describe, expect, it, vi } from 'vitest'
import type { ChatEvent, ChatRequest, ProviderChunk } from '@sidekick/shared'
import { createChatStream } from '../src/services/chatService.js'
import { budgetSettings } from '../src/db/schema.js'
import type { ProviderAdapter } from '../src/providers/types.js'
import type { ProviderRegistry } from '../src/providers/registry.js'

/**
 * Test cho enforce budget cap trong `chatService` (T-M2-03b — FR-PROVIDER-06).
 *
 * AC goc: "Khi vượt hạn mức, server **chặn lượt chat mới** và **không gọi
 * provider**" → test phai kiem tra provider **khong** duoc goi.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.24
 */

interface FakeDbOptions {
  /** Han muc (USD). */
  limitUsd?: number
  /** Budget co bat hay khong. */
  enabled?: boolean
  /** Chan luot chat moi hay khong. */
  hardBlock?: boolean
  /** Chi phi da dung trong ky (USD). */
  spentUsd?: number
}

/**
 * Tao DB gia lap phuc vu budget cap.
 *
 * - `budget_settings` → tra 1 dong cau hinh.
 * - `request_logs` → tra tong chi phi da ghep (`sum`).
 * - `messages` → ghi user/assistant message.
 *
 * @param options - Cau hinh budget gia lap.
 */
function makeDb(options: FakeDbOptions): { db: unknown } {
  const budgetRow = {
    id: 'default',
    enabled: options.enabled ?? true,
    limitUsd: String(options.limitUsd ?? 10),
    warnThresholdPercent: 80,
    period: 'monthly',
    hardBlock: options.hardBlock ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const insert = vi.fn(() => ({
    values: (_items: unknown) => {
      const promise = Promise.resolve([]) as unknown as Promise<unknown[]> & {
        onConflictDoNothing: () => Promise<unknown[]>
        onConflictDoUpdate: () => Promise<unknown[]>
        returning: (columns?: unknown) => Promise<unknown[]>
      }
      promise.onConflictDoNothing = () => Promise.resolve([])
      promise.onConflictDoUpdate = () => Promise.resolve([])
      promise.returning = () => Promise.resolve([{ id: 'msg-1' }])
      return promise
    },
  }))

  const select = vi.fn((fields?: Record<string, unknown>) => ({
    from: (table: unknown) => {
      // Tong chi phi trong ky → `select({ total })`.
      if (fields !== undefined && 'total' in fields) {
        return {
          where: () =>
            Promise.resolve([{ total: String(options.spentUsd ?? 0) }]),
        }
      }

      if (table === budgetSettings) {
        return {
          where: () => ({
            limit: async () => [budgetRow],
          }),
        }
      }

      return {
        where: () => ({
          orderBy: () => ({
            limit: async () => [],
          }),
          limit: async () => [],
        }),
      }
    },
  }))

  const db = {
    insert,
    select,
    update: vi.fn(() => ({
      set: () => ({
        where: () => ({
          returning: async () => [],
        }),
      }),
    })),
  }

  return {
    db,
  }
}

/**
 * Tao provider gia lap — ghi nhan da goi hay chua.
 *
 * @param chunks - Các chunk se yield.
 * @param onCall - Callback khi provider duoc goi.
 */
function makeProvider(
  chunks: ProviderChunk[],
  onCall: () => void,
): ProviderAdapter {
  return {
    id: 'mock',
    name: 'Mock',
    requiresKey: false,
    supportsVision: () => true,
    testKey: async () => ({ ok: true }),
    listModels: async () => ['mock-model'],
    resolveModel: (requested?: string) => requested ?? 'mock-model',
    async *stream() {
      onCall()
      for (const chunk of chunks) {
        yield chunk
      }
    },
  }
}

/**
 * Tao registry gia lap.
 *
 * @param provider - Provider duy nhat.
 */
function makeRegistry(provider: ProviderAdapter): ProviderRegistry {
  return {
    get: () => provider,
    require: () => provider,
    list: () => [provider],
    getFallbackChain: () => ['mock'] as never,
    getFallbacks: () => [] as never,
  } as unknown as ProviderRegistry
}

/**
 * Thu thap tat ca event tu generator.
 *
 * @param generator - Generator chat.
 */
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

describe('budget cap trong chatService (T-M2-03b)', () => {
  it('vuot han muc + hardBlock → KHONG goi provider, error BUDGET_EXCEEDED', async () => {
    let providerCalled = false
    const provider = makeProvider([{ kind: 'token', text: 'sai' }], () => {
      providerCalled = true
    })
    const fake = makeDb({ limitUsd: 10, spentUsd: 25, hardBlock: true })

    const result = createChatStream(
      {
        db: fake.db as never,
        registry: makeRegistry(provider),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    // Provider **khong** duoc goi → chi phi = 0.
    expect(providerCalled).toBe(false)

    const budget = events.find((event) => event.type === 'budget')
    expect(budget).toMatchObject({ type: 'budget', state: 'exceeded' })

    const error = events.find((event) => event.type === 'error')
    expect(error).toMatchObject({
      type: 'error',
      code: 'BUDGET_EXCEEDED',
      retryable: false,
    })

    expect(events[events.length - 1]).toMatchObject({
      type: 'done',
      finishReason: 'error',
    })
  })

  it('vuot han muc + hardBlock → KHONG tao turn (khong co event meta)', async () => {
    let providerCalled = false
    const provider = makeProvider([{ kind: 'token', text: 'sai' }], () => {
      providerCalled = true
    })
    const fake = makeDb({ limitUsd: 1, spentUsd: 9 })
    const result = createChatStream(
      {
        db: fake.db as never,
        registry: makeRegistry(provider),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    expect(events.find((event) => event.type === 'meta')).toBeUndefined()
    expect(events.find((event) => event.type === 'token')).toBeUndefined()
    expect(providerCalled).toBe(false)
  })

  it('vuot han muc + hardBlock TAT → van chat binh thuong (chi canh bao)', async () => {
    let providerCalled = false
    const provider = makeProvider(
      [
        { kind: 'token', text: 'ok' },
        { kind: 'usage', tokensIn: 10, tokensOut: 5 },
        { kind: 'done', finishReason: 'stop' },
      ],
      () => {
        providerCalled = true
      },
    )
    const fake = makeDb({ limitUsd: 1, spentUsd: 9, hardBlock: false })

    const result = createChatStream(
      {
        db: fake.db as never,
        registry: makeRegistry(provider),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    expect(providerCalled).toBe(true)
    expect(events.find((event) => event.type === 'error')).toBeUndefined()
    expect(events.find((event) => event.type === 'meta')).toBeDefined()

    const budget = events.find((event) => event.type === 'budget')
    expect(budget).toMatchObject({ type: 'budget', state: 'exceeded' })
  })

  it('duoi han muc → chat binh thuong + event budget state ok', async () => {
    let providerCalled = false
    const provider = makeProvider(
      [
        { kind: 'token', text: 'ok' },
        { kind: 'done', finishReason: 'stop' },
      ],
      () => {
        providerCalled = true
      },
    )
    const fake = makeDb({ limitUsd: 10, spentUsd: 1 })

    const result = createChatStream(
      {
        db: fake.db as never,
        registry: makeRegistry(provider),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    expect(providerCalled).toBe(true)
    const budget = events.find((event) => event.type === 'budget')
    expect(budget).toMatchObject({ type: 'budget', state: 'ok' })
    expect(events[events.length - 1]).toMatchObject({ type: 'done', finishReason: 'stop' })
  })

  it('budget TAT → chat binh thuong, state disabled', async () => {
    let providerCalled = false
    const provider = makeProvider(
      [
        { kind: 'token', text: 'ok' },
        { kind: 'done', finishReason: 'stop' },
      ],
      () => {
        providerCalled = true
      },
    )
    const fake = makeDb({ enabled: false, limitUsd: 1, spentUsd: 99 })

    const result = createChatStream(
      {
        db: fake.db as never,
        registry: makeRegistry(provider),
        envKeys: {},
        masterKey: undefined,
        logFullContent: false,
        logRequests: true,
        logContextSnapshot: false,
      },
      request,
      new AbortController().signal,
    )
    const events = await collectEvents(result.events)

    expect(providerCalled).toBe(true)
    const budget = events.find((event) => event.type === 'budget')
    expect(budget).toMatchObject({ type: 'budget', state: 'disabled' })
  })
})
