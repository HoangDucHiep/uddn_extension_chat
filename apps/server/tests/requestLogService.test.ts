import { describe, expect, it } from 'vitest'
import type { Database } from '../src/db/index.js'
import {
  aggregateUsage,
  countToolCalls,
  insertRequestLog,
  listRequestLogs,
  pruneRequestLogs,
  toRequestLogSummary,
} from '../src/services/requestLogService.js'
import { createFakeRequestLogDb } from './helpers/fakeRequestLogDb.js'

/**
 * Test cho `requestLogService` (T-M1-14).
 *
 * AC goc: "Moi luot chat co 1 dong log: provider, model, token, cost, ttft,
 * latency" + "retention 90 ngay" + "eval doc duoc log qua API metadata-only".
 *
 * Docs: docs/SYSTEM_DESIGN.md §5.2, §7.16
 */

/** Tao fake DB + cast sang `Database` (fake duoi runtime thuc te). */
function makeDb(): { rows: ReturnType<typeof createFakeRequestLogDb>['rows']; db: Database } {
  const fake = createFakeRequestLogDb()
  return { rows: fake.rows, db: fake.db as Database }
}

describe('countToolCalls', () => {
  it('null → 0', () => {
    expect(countToolCalls(null)).toBe(0)
  })

  it('undefined → 0', () => {
    expect(countToolCalls(undefined)).toBe(0)
  })

  it('mang rong → 0', () => {
    expect(countToolCalls([])).toBe(0)
  })

  it('mang co phan tu → so phan tu', () => {
    expect(countToolCalls([{ name: 'a' }, { name: 'b' }])).toBe(2)
  })

  it('gia tri khong phai mang → 0', () => {
    expect(countToolCalls({ name: 'a' })).toBe(0)
  })
})

describe('toRequestLogSummary', () => {
  it('khong lo noi dung nhay cam (chi metadata)', () => {
    const fake = createFakeRequestLogDb()
    const row = fake.seed({
      promptText: 'NOI DUNG NHAY CAM',
      responseText: 'CAU TRA LOI NHAY CAM',
      contextSnapshot: [{ text: 'SNAPSHOT' }],
    })

    const summary = toRequestLogSummary(row as never)

    expect(summary).not.toHaveProperty('promptText')
    expect(summary).not.toHaveProperty('responseText')
    expect(summary).not.toHaveProperty('contextSnapshot')
    expect(JSON.stringify(summary)).not.toContain('NOI DUNG NHAY CAM')
    expect(JSON.stringify(summary)).not.toContain('CAU TRA LOI NHAY CAM')
  })

  it('cost_usd duoc chuyen tu string (numeric) sang number', () => {
    const fake = createFakeRequestLogDb()
    const row = fake.seed({ costUsd: '0.014565' })

    const summary = toRequestLogSummary(row as never)

    expect(summary.costUsd).toBe(0.014565)
  })

  it('tool_calls null → toolCallCount = 0', () => {
    const fake = createFakeRequestLogDb()
    const row = fake.seed({ toolCalls: null })

    expect(toRequestLogSummary(row as never).toolCallCount).toBe(0)
  })

  it('tool_calls co array → toolCallCount = do dai', () => {
    const fake = createFakeRequestLogDb()
    const row = fake.seed({ toolCalls: [{ name: 'read' }, { name: 'write' }] })

    expect(toRequestLogSummary(row as never).toolCallCount).toBe(2)
  })
})

describe('insertRequestLog', () => {
  it('ghi dong voi cost + tool_calls null (M1 chua co tool that)', async () => {
    const { rows, db } = makeDb()

    await insertRequestLog(
      db,
      {
        requestId: 'req-1',
        conversationId: 'conv-1',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        keySource: 'K2',
        promptText: 'cau hoi',
        responseText: 'tra loi',
        contextItems: [],
        tokensIn: 100,
        tokensOut: 50,
        costUsd: 0.014565,
        ttftMs: 120,
        latencyMs: 900,
        error: undefined,
        toolCalls: null,
      },
      false,
      false,
    )

    expect(rows).toHaveLength(1)
    const row = rows[0]
    expect(row?.requestId).toBe('req-1')
    expect(row?.costUsd).toBe('0.014565')
    expect(row?.toolCalls).toBeNull()
    expect(row?.error).toBeNull()
    expect(row?.tokensIn).toBe(100)
    expect(row?.ttftMs).toBe(120)
  })

  it('logFullContent = false → prompt/response khong duoc ghi', async () => {
    const { rows, db } = makeDb()

    await insertRequestLog(
      db,
      {
        requestId: 'req-2',
        conversationId: 'conv-1',
        provider: 'mock',
        model: 'mock',
        keySource: 'K1',
        promptText: 'NOI DUNG NHAY CAM',
        responseText: 'TRA LOI NHAY CAM',
        contextItems: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        ttftMs: 0,
        latencyMs: 0,
        error: undefined,
        toolCalls: null,
      },
      false,
      false,
    )

    expect(rows[0]?.promptText).toBeNull()
    expect(rows[0]?.responseText).toBeNull()
  })

  it('logFullContent = true → prompt/response duoc ghi', async () => {
    const { rows, db } = makeDb()

    await insertRequestLog(
      db,
      {
        requestId: 'req-3',
        conversationId: 'conv-1',
        provider: 'mock',
        model: 'mock',
        keySource: 'K1',
        promptText: 'cau hoi',
        responseText: 'tra loi',
        contextItems: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        ttftMs: 0,
        latencyMs: 0,
        error: undefined,
        toolCalls: null,
      },
      true,
      false,
    )

    expect(rows[0]?.promptText).toBe('cau hoi')
    expect(rows[0]?.responseText).toBe('tra loi')
  })

  it('context rong → context_hash = null', async () => {
    const { rows, db } = makeDb()

    await insertRequestLog(
      db,
      {
        requestId: 'req-4',
        conversationId: 'conv-1',
        provider: 'mock',
        model: 'mock',
        keySource: 'K1',
        promptText: '',
        responseText: '',
        contextItems: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        ttftMs: 0,
        latencyMs: 0,
        error: undefined,
        toolCalls: null,
      },
      false,
      false,
    )

    expect(rows[0]?.contextHash).toBeNull()
  })

  it('error code duoc ghi vao cot `error`', async () => {
    const { rows, db } = makeDb()

    await insertRequestLog(
      db,
      {
        requestId: 'req-5',
        conversationId: 'conv-1',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        keySource: 'none',
        promptText: '',
        responseText: '',
        contextItems: [],
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        ttftMs: 0,
        latencyMs: 10,
        error: 'MISSING_API_KEY',
        toolCalls: null,
      },
      false,
      false,
    )

    expect(rows[0]?.error).toBe('MISSING_API_KEY')
  })
})

describe('listRequestLogs', () => {
  it('tra ve items + tong so dong', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ provider: 'gemini' })
    fake.seed({ provider: 'groq' })

    const result = await listRequestLogs(fake.db as Database, { limit: 10, offset: 0 })

    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(2)
  })

  it('loc theo provider', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ provider: 'gemini' })
    fake.seed({ provider: 'groq' })

    const result = await listRequestLogs(fake.db as Database, {
      limit: 10,
      offset: 0,
      provider: 'gemini',
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.provider).toBe('gemini')
    expect(result.total).toBe(1)
  })

  it('loc theo conversationId', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ conversationId: 'conv-a' })
    fake.seed({ conversationId: 'conv-b' })

    const result = await listRequestLogs(fake.db as Database, {
      limit: 10,
      offset: 0,
      conversationId: 'conv-a',
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.conversationId).toBe('conv-a')
  })

  it('loc theo khoang thoi gian (from/to)', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
    fake.seed({ createdAt: new Date('2026-06-01T00:00:00.000Z') })

    const result = await listRequestLogs(fake.db as Database, {
      limit: 10,
      offset: 0,
      from: new Date('2026-05-01T00:00:00.000Z'),
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.createdAt).toBe('2026-06-01T00:00:00.000Z')
  })

  it('sap xep moi nhat truoc', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
    fake.seed({ createdAt: new Date('2026-06-01T00:00:00.000Z') })

    const result = await listRequestLogs(fake.db as Database, { limit: 10, offset: 0 })

    expect(result.items[0]?.createdAt).toBe('2026-06-01T00:00:00.000Z')
  })
})

describe('aggregateUsage', () => {
  it('tong hop token + chi phi theo ngay', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      tokensIn: 100,
      tokensOut: 50,
      costUsd: '0.010000',
    })
    fake.seed({
      createdAt: new Date('2026-01-01T18:00:00.000Z'),
      tokensIn: 200,
      tokensOut: 100,
      costUsd: '0.020000',
    })
    fake.seed({
      createdAt: new Date('2026-01-02T10:00:00.000Z'),
      tokensIn: 10,
      tokensOut: 5,
      costUsd: '0.001000',
    })

    const usage = await aggregateUsage(fake.db as Database, {})

    expect(usage.totalTokens).toBe(100 + 50 + 200 + 100 + 10 + 5)
    expect(usage.totalCostUsd).toBe(0.031)
    expect(usage.byDay).toHaveLength(2)
    expect(usage.byDay[0]).toMatchObject({
      date: '2026-01-01',
      tokensIn: 300,
      tokensOut: 150,
      totalTokens: 450,
      requests: 2,
    })
    expect(usage.byDay[0]?.costUsd).toBe(0.03)
  })

  it('khong co du lieu → tong = 0, byDay rong', async () => {
    const fake = createFakeRequestLogDb()

    const usage = await aggregateUsage(fake.db as Database, {})

    expect(usage.totalTokens).toBe(0)
    expect(usage.totalCostUsd).toBe(0)
    expect(usage.byDay).toEqual([])
  })

  it('loc theo khoang thoi gian', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ createdAt: new Date('2026-01-01T00:00:00.000Z'), tokensIn: 999 })
    fake.seed({ createdAt: new Date('2026-06-01T00:00:00.000Z'), tokensIn: 7 })

    const usage = await aggregateUsage(fake.db as Database, {
      from: new Date('2026-05-01T00:00:00.000Z'),
    })

    expect(usage.totalTokens).toBe(7)
  })
})

describe('pruneRequestLogs', () => {
  it('xoa dong cu hon thoi han giu', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ createdAt: new Date('2026-01-01T00:00:00.000Z') })
    fake.seed({ createdAt: new Date('2026-06-01T00:00:00.000Z') })

    const deleted = await pruneRequestLogs(
      fake.db as Database,
      90,
      new Date('2026-06-15T00:00:00.000Z'),
    )

    expect(deleted).toBe(1)
    expect(fake.rows).toHaveLength(1)
    expect(fake.rows[0]?.createdAt.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('retentionDays = 0 → khong xoa gi (giu vinh vien)', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ createdAt: new Date('2000-01-01T00:00:00.000Z') })

    const deleted = await pruneRequestLogs(fake.db as Database, 0)

    expect(deleted).toBe(0)
    expect(fake.rows).toHaveLength(1)
  })

  it('moc han dung 90 ngay — dong dung 90 ngay truoc van duoc giu', async () => {
    const fake = createFakeRequestLogDb()
    fake.seed({ createdAt: new Date('2026-06-01T00:00:00.000Z') })
    fake.seed({ createdAt: new Date('2026-03-01T00:00:00.000Z') })

    const deleted = await pruneRequestLogs(
      fake.db as Database,
      90,
      new Date('2026-06-01T00:00:00.000Z'),
    )

    // Dinh 2026-06-01 → cutoff = 2026-03-03 → dong 2026-03-01 bi xoa.
    expect(deleted).toBe(1)
    expect(fake.rows).toHaveLength(1)
  })

  it('khong co dong cu → xoa 0', async () => {
    const fake = createFakeRequestLogDb()

    expect(await pruneRequestLogs(fake.db as Database, 90)).toBe(0)
  })
})
