/**
 * Fake Drizzle DB cho budget cap (T-M2-03b).
 *
 * BFF thuc te dung Postgres 16, nhung unit test phai chay **khong can Docker**
 * → fake o day mo phong 2 bang ma `budgetService` su dung:
 *
 * - `budget_settings` — 1 dong singleton (upsert).
 * - `request_logs` — chi dung de **tong** `cost_usd` trong ky.
 *
 * Filter duoc phan tich tu **cau truc SQL chunk** cua Drizzle (khong
 * hardcode chuoi SQL) → test phan anh `eq` / `gte` that.
 *
 * Docs: docs/SYSTEM_DESIGN.md §5, §7.24
 */

import { budgetSettings, requestLogs } from '../../src/db/schema.js'

/** Mot dong trong bang `budget_settings`. */
export interface FakeBudgetSettingsRow {
  id: string
  enabled: boolean
  limitUsd: string
  warnThresholdPercent: number
  period: string
  hardBlock: boolean
  createdAt: Date
  updatedAt: Date
}

/** Fake DB cho budget cap. */
export interface FakeBudgetDb {
  /** Dong cau hinh hien tai (undefined = chua co dong). */
  settings: FakeBudgetSettingsRow | undefined
  /** Cac dong `request_logs` (chi de tinh tong chi phi). */
  logs: Array<{ createdAt: Date; costUsd: string }>
  /** DB gia lap cho Drizzle. */
  db: unknown
  /** Dat cau hinh truc tiep (test setup). */
  setSettings: (patch: Partial<FakeBudgetSettingsRow>) => FakeBudgetSettingsRow
  /** Them 1 dong log (test setup). */
  addLog: (log: { createdAt?: Date; costUsd?: number }) => void
}

/**
 * Kiem tra chunk co phai `Column` cua Drizzle khong.
 *
 * @param chunk - Chunk can kiem tra.
 */
function isColumn(chunk: unknown): chunk is { name: string } {
  return (
    typeof chunk === 'object' &&
    chunk !== null &&
    typeof (chunk as { name?: unknown }).name === 'string' &&
    'table' in (chunk as Record<string, unknown>)
  )
}

/**
 * Kiem tra chunk co phai `Param` cua Drizzle khong.
 *
 * @param chunk - Chunk can kiem tra.
 */
function isParam(chunk: unknown): chunk is { value: unknown } {
  return (
    typeof chunk === 'object' &&
    chunk !== null &&
    (chunk as { constructor?: { name?: string } }).constructor?.name === 'Param' &&
    'value' in (chunk as Record<string, unknown>)
  )
}

/**
 * Lay danh sach chunk cua 1 SQL node (flatten 1 cap).
 *
 * @param node - Node can kiem tra.
 */
function getChunks(node: unknown): unknown[] {
  if (typeof node !== 'object' || node === null) return []
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return []

  const leaves: unknown[] = []
  for (const chunk of chunks) {
    if (isColumn(chunk) || isParam(chunk) || typeof chunk === 'string') {
      leaves.push(chunk)
      continue
    }
    const nested = getChunks(chunk)
    if (nested.length > 0) {
      leaves.push(...nested)
      continue
    }
    leaves.push(chunk)
  }
  return leaves
}

/**
 * Trich gia tri tham so dau tien cua dieu kien (dung cho `eq` / `gte`).
 *
 * @param condition - Dieu kien Drizzle.
 * @returns Gia tri tham so (Date | string | number | boolean | undefined).
 */
function extractParam(condition: unknown): unknown {
  const chunks = getChunks(condition)
  for (const chunk of chunks) {
    if (isParam(chunk)) return chunk.value
    if (chunk instanceof Date) return chunk
  }
  return undefined
}

/**
 * Lay ten cot ma dieu kien so sanh.
 *
 * @param condition - Dieu kien Drizzle.
 */
function extractColumn(condition: unknown): string | undefined {
  const chunks = getChunks(condition)
  for (const chunk of chunks) {
    if (isColumn(chunk)) return chunk.name
  }
  return undefined
}

/**
 * Tao fake DB cho budget cap.
 */
export function createFakeBudgetDb(): FakeBudgetDb {
  const state: FakeBudgetDb = {
    settings: undefined,
    logs: [],
    db: undefined,
    setSettings: (patch) => {
      const current = state.settings
      const next: FakeBudgetSettingsRow = {
        id: current?.id ?? 'default',
        enabled: patch.enabled ?? current?.enabled ?? false,
        limitUsd: patch.limitUsd ?? current?.limitUsd ?? '0',
        warnThresholdPercent:
          patch.warnThresholdPercent ?? current?.warnThresholdPercent ?? 80,
        period: patch.period ?? current?.period ?? 'monthly',
        hardBlock: patch.hardBlock ?? current?.hardBlock ?? true,
        createdAt: current?.createdAt ?? new Date(),
        updatedAt: patch.updatedAt ?? new Date(),
      }
      state.settings = next
      return next
    },
    addLog: (log) => {
      state.logs.push({
        createdAt: log.createdAt ?? new Date(),
        costUsd: String(log.costUsd ?? 0),
      })
    },
  }

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        if (table === budgetSettings) {
          return {
            where: (condition: unknown) => ({
              limit: async (count: number) => {
                if (state.settings === undefined) return []
                const wanted = extractParam(condition)
                if (wanted !== undefined && state.settings.id !== wanted) return []
                return count > 0 ? [state.settings] : [state.settings]
              },
            }),
          }
        }

        if (table === requestLogs) {
          return {
            where: (condition: unknown) => {
              const column = extractColumn(condition)
              const threshold = extractParam(condition)

              const matched = state.logs.filter((log) => {
                if (column !== 'created_at') return true
                if (!(threshold instanceof Date)) return true
                return log.createdAt.getTime() >= threshold.getTime()
              })

              // Query tong hop: `coalesce(sum(cost_usd), 0)`.
              if (fields !== undefined && 'total' in fields) {
                const total = matched.reduce((sum, log) => sum + Number(log.costUsd), 0)
                return Promise.resolve([{ total }])
              }

              return Promise.resolve(matched)
            },
          }
        }

        throw new Error('fakeBudgetDb chi ho tro bang `budget_settings` / `request_logs`')
      },
    }),

    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: async (options?: { set?: Record<string, unknown> }) => {
          if (table !== budgetSettings) {
            throw new Error('fakeBudgetDb chi ho tro bang `budget_settings`')
          }
          const set = options?.set ?? {}
          state.setSettings({
            id: (values['id'] as string) ?? 'default',
            enabled: (set['enabled'] ?? values['enabled']) as boolean,
            limitUsd: String(set['limitUsd'] ?? values['limitUsd'] ?? '0'),
            warnThresholdPercent: Number(
              set['warnThresholdPercent'] ?? values['warnThresholdPercent'] ?? 80,
            ),
            period: (set['period'] ?? values['period']) as string,
            hardBlock: (set['hardBlock'] ?? values['hardBlock']) as boolean,
            updatedAt: (set['updatedAt'] ?? values['updatedAt']) as Date,
          })
          return [state.settings]
        },
      }),
    }),
  }

  state.db = db
  return state
}
