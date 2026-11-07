/**
 * Fake Drizzle DB cho bang `request_logs` — dung unit test T-M1-14.
 *
 * BFF thuc te dung Postgres 16, nhung unit test phai chay **khong can Docker**
 * → fake o day mo phong chuoi goi Drizzle ma `requestLogService` su dung:
 *
 * ```ts
 * db.select().from(...).where(...).orderBy(...).limit(...).offset(...)
 * db.select({ total: count(...) }).from(...).where(...)
 * db.select({ date, tokensIn, ... }).from(...).where(...).groupBy(...).orderBy(...)
 * db.insert(...).values(...)
 * db.delete(...).where(...).returning(...)
 * ```
 *
 * Filter duoc phan tich tu **cau truc SQL chunk** cua Drizzle (khong
 * hardcode chuoi SQL) → test phan anh `eq` / `gte` / `lte` that.
 *
 * Docs: docs/SYSTEM_DESIGN.md §5, §7.16
 */

import { requestLogs } from '../../src/db/schema.js'

/** Mot dong trong bang `request_logs` (shape giong schema). */
export interface FakeRequestLogRow {
  id: string
  requestId: string
  conversationId: string | null
  provider: string
  model: string
  keySource: string
  promptText: string | null
  contextHash: string | null
  contextSnapshot: unknown
  responseText: string | null
  tokensIn: number
  tokensOut: number
  costUsd: string
  ttftMs: number
  latencyMs: number
  toolCalls: unknown
  error: string | null
  createdAt: Date
}

/** Map ten cot DB (snake_case) sang ten truong TS (camelCase). */
const COLUMN_TO_PROP: Record<string, keyof FakeRequestLogRow> = {
  id: 'id',
  request_id: 'requestId',
  conversation_id: 'conversationId',
  provider: 'provider',
  model: 'model',
  key_source: 'keySource',
  prompt_text: 'promptText',
  context_hash: 'contextHash',
  context_snapshot: 'contextSnapshot',
  response_text: 'responseText',
  tokens_in: 'tokensIn',
  tokens_out: 'tokensOut',
  cost_usd: 'costUsd',
  ttft_ms: 'ttftMs',
  latency_ms: 'latencyMs',
  tool_calls: 'toolCalls',
  error: 'error',
  created_at: 'createdAt',
}

/** Cay dieu kien da phan tich tu SQL chunk. */
type Predicate =
  | { kind: 'and'; children: Predicate[] }
  | { kind: 'cmp'; column: string; op: string; values: unknown[] }

/**
 * Kiem tra chunk co phai `StringChunk` cua Drizzle khong.
 *
 * @param chunk - Chunk can kiem tra.
 */
function isStringChunk(chunk: unknown): chunk is { value: string[] } {
  return (
    typeof chunk === 'object' &&
    chunk !== null &&
    Array.isArray((chunk as { value?: unknown }).value) &&
    (chunk as { value: unknown[] }).value.every((item) => typeof item === 'string')
  )
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
 * Lay danh sach chunk cua 1 SQL node.
 *
 * @param node - Node can kiem tra.
 */
function getChunks(node: unknown): unknown[] {
  if (typeof node !== 'object' || node === null) return []
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  return Array.isArray(chunks) ? chunks : []
}

/**
 * Lam phang cac chunk long nhau thanh list "la" (Column / Param / String).
 *
 * Drizzle bao gio bọc gia tri trong `SQL(...)` → phai mo ra de parse duoc
 * toan bo dieu kien.
 *
 * @param chunks - Can flatten.
 */
function flattenLeaves(chunks: readonly unknown[]): unknown[] {
  const leaves: unknown[] = []

  for (const chunk of chunks) {
    if (isColumn(chunk) || isParam(chunk) || isStringChunk(chunk) || typeof chunk === 'string') {
      leaves.push(chunk)
      continue
    }
    const nested = getChunks(chunk)
    if (nested.length > 0) {
      leaves.push(...flattenLeaves(nested))
      continue
    }
    leaves.push(chunk)
  }

  return leaves
}

/**
 * Phan tich SQL chunk thanh cay dieu kien.
 *
 * @param node - Node SQL/condition.
 */
function parsePredicate(node: unknown): Predicate {
  const chunks = getChunks(node)
  if (chunks.length === 0) return { kind: 'and', children: [] }

  // Node co `Column` o cap hien tai → day la so sanh don gian.
  if (chunks.some((chunk) => isColumn(chunk))) {
    return parseTerm(flattenLeaves(chunks)) ?? { kind: 'and', children: [] }
  }

  // Node nhom → tach theo separator ` and ` / ` or `.
  const groups: Array<{ separator: string; items: unknown[] }> = []
  let currentItems: unknown[] = []
  let nextSeparator = 'and'

  for (const chunk of chunks) {
    if (isStringChunk(chunk)) {
      const text = chunk.value.join('').trim().toLowerCase()
      if (text === 'and' || text === 'or') {
        if (currentItems.length > 0) {
          groups.push({ separator: nextSeparator, items: currentItems })
        }
        currentItems = []
        nextSeparator = text
        continue
      }
      // Chuoi khac (toan tu so sanh) → giu lai trong nhom hien tai.
      currentItems.push(chunk)
      continue
    }
    currentItems.push(chunk)
  }
  if (currentItems.length > 0) {
    groups.push({ separator: nextSeparator, items: currentItems })
  }

  if (groups.length === 0) return { kind: 'and', children: [] }

  const children = groups
    .map((group) => {
      const only = group.items[0]
      if (only !== undefined && group.items.length === 1 && getChunks(only).length > 0) {
        return parsePredicate(only)
      }
      return parseTerm(flattenLeaves(group.items))
    })
    .filter((child): child is Predicate => child !== null)

  if (children.length === 1) return children[0] ?? { kind: 'and', children: [] }

  return combineGroups(children, groups.map((group) => group.separator))
}

/**
 * Gom cac dieu kien theo chuoi separator xen ke.
 *
 * @param children - Dieu kien tung phan tu.
 * @param separators - Separator truoc moi phan tu.
 */
function combineGroups(
  children: Predicate[],
  separators: string[],
): Predicate {
  if (children.length === 1) return children[0] ?? { kind: 'and', children: [] }

  const root: Predicate = { kind: 'and', children: [children[0] ?? { kind: 'and', children: [] }] }
  const rootChildren = root.children as Predicate[]

  for (let index = 1; index < children.length; index += 1) {
    const child = children[index]
    if (child === undefined) continue
    const separator = separators[index] ?? 'and'

    if (separator === 'or') {
      const last = rootChildren[rootChildren.length - 1]
      if (last !== undefined && last.kind === 'and') {
        last.children.push(child)
        continue
      }
    }

    rootChildren.push(child)
  }

  return root
}

/**
 * Phan tich mot nhom chunk thanh 1 dieu kien so sanh.
 *
 * @param items - Cac chunk cua nhom.
 */
function parseTerm(items: readonly unknown[]): Predicate | null {
  const columnChunk = items.find((chunk) => isColumn(chunk))
  if (columnChunk === undefined) return null

  let op = ''
  let value: unknown

  for (const chunk of items) {
    if (isColumn(chunk)) continue
    if (isStringChunk(chunk)) {
      op += chunk.value.join('')
      continue
    }
    if (isParam(chunk)) {
      value = chunk.value
      continue
    }
    if (typeof chunk === 'string') {
      value = chunk
      continue
    }
    // Raw `sql` template ghep truc tiep gia tri (vd `Date`) — khong boc
    // trong `Param` → phai nhan gia tri day.
    if (chunk instanceof Date || typeof chunk === 'number' || typeof chunk === 'boolean') {
      value = chunk
      continue
    }
  }

  return {
    kind: 'cmp',
    column: columnChunk.name,
    op: op.trim(),
    values: value === undefined ? [] : [value],
  }
}

/**
 * So sanh gia tri cua 1 dong voi dieu kien.
 *
 * @param predicate - Cay dieu kien.
 * @param row - Dong can kiem tra.
 */
function matches(predicate: Predicate, row: FakeRequestLogRow): boolean {
  if (predicate.kind === 'and') {
    return predicate.children.every((child) => matches(child, row))
  }

  const prop = COLUMN_TO_PROP[predicate.column]
  if (prop === undefined) return true

  const actual = row[prop]
  const [expected] = predicate.values
  if (expected === undefined) return true

  if (predicate.op.includes('<')) {
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() < expected.getTime()
    }
    return Number(actual) < Number(expected)
  }
  if (predicate.op.includes('>')) {
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() > expected.getTime()
    }
    return Number(actual) > Number(expected)
  }
  if (predicate.op.includes('!=') || predicate.op.includes('<>')) {
    return actual !== expected
  }
  return actual === expected
}

/** Builder co the `await` duoc — moi method tra ve chinh no. */
class QueryBuilder<T> implements PromiseLike<T> {
  /** Dieu kien loc. */
  condition: unknown = undefined
  /** Thu tu sap xep. */
  orders: Array<{ column: string; descending: boolean }> = []
  /** Query co gom nhom hay khong. */
  isGrouped = false
  /** So dong toi da tra ve. */
  maxRows: number | undefined = undefined
  /** So dong bo qua. */
  skipRows = 0

  constructor(private readonly run: () => Promise<T>) {}

  where(condition: unknown): QueryBuilder<T> {
    this.condition = condition
    return this
  }

  orderBy(...orders: unknown[]): QueryBuilder<T> {
    this.orders = orders.flatMap((order) => parseOrder(order))
    return this
  }

  limit(count: number): QueryBuilder<T> {
    this.maxRows = count
    return this
  }

  offset(count: number): QueryBuilder<T> {
    this.skipRows = count
    return this
  }

  groupBy(_column: unknown): QueryBuilder<T> {
    this.isGrouped = true
    return this
  }

  returning(_fields?: unknown): QueryBuilder<T> {
    return this
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }
}

/**
 * Trich thu tu sap xep tu mot chunk `asc`/`desc` cua Drizzle.
 *
 * @param order - Chunk order.
 */
function parseOrder(order: unknown): Array<{ column: string; descending: boolean }> {
  const chunks = (order as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return []

  let column: string | undefined
  let descending = false

  for (const chunk of chunks) {
    if (isColumn(chunk)) {
      column = chunk.name
      continue
    }
    if (isStringChunk(chunk)) {
      const text = chunk.value.join('').trim().toLowerCase()
      if (text === 'desc') descending = true
      if (text === 'asc') descending = false
    }
  }

  if (column === undefined) return []
  return [{ column, descending }]
}

/** Fake DB cho bang `request_logs`. */
export interface FakeRequestLogDb {
  /** Cac dong `request_logs`. */
  rows: FakeRequestLogRow[]
  /** DB gia lap cho Drizzle. */
  db: unknown
  /** Them 1 dong log truc tiep (test setup). */
  seed: (row: Partial<FakeRequestLogRow>) => FakeRequestLogRow
}

/**
 * Tao fake DB cho bang `request_logs`.
 *
 * @param initial - Du lieu khoi tao.
 */
export function createFakeRequestLogDb(
  initial: { rows?: FakeRequestLogRow[] } = {},
): FakeRequestLogDb {
  const rows: FakeRequestLogRow[] = [...(initial.rows ?? [])]
  let counter = 0

  const state: FakeRequestLogDb = {
    rows,
    db: undefined,
    seed: (row) => {
      counter += 1
      const full: FakeRequestLogRow = {
        id: row.id ?? `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
        requestId: row.requestId ?? `req-${counter}`,
        conversationId: row.conversationId ?? null,
        provider: row.provider ?? 'mock',
        model: row.model ?? 'mock-model',
        keySource: row.keySource ?? 'K1',
        promptText: row.promptText ?? null,
        contextHash: row.contextHash ?? null,
        contextSnapshot: row.contextSnapshot ?? null,
        responseText: row.responseText ?? null,
        tokensIn: row.tokensIn ?? 0,
        tokensOut: row.tokensOut ?? 0,
        costUsd: row.costUsd ?? '0.000000',
        ttftMs: row.ttftMs ?? 0,
        latencyMs: row.latencyMs ?? 0,
        toolCalls: row.toolCalls ?? null,
        error: row.error ?? null,
        createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      }
      rows.push(full)
      return full
    },
  }

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        if (table !== requestLogs) {
          throw new Error('fakeRequestLogDb chi ho tro bang `request_logs`')
        }

        const builder: QueryBuilder<unknown[]> = new QueryBuilder<unknown[]>(async () => {
          let matched: FakeRequestLogRow[] = rows.filter((row: FakeRequestLogRow) =>
            builder.condition === undefined
              ? true
              : matches(parsePredicate(builder.condition), row),
          )

          // Query dem (`count`).
          if (fields !== undefined && 'total' in fields) {
            return [{ total: matched.length }]
          }

          // Query tong hop theo ngay (`to_char(created_at, 'YYYY-MM-DD')`).
          if (fields !== undefined && 'date' in fields) {
            const groups = new Map<
              string,
              { tokensIn: number; tokensOut: number; costUsd: number; requests: number }
            >()
            for (const row of matched) {
              const key = row.createdAt.toISOString().slice(0, 10)
              const group = groups.get(key) ?? {
                tokensIn: 0,
                tokensOut: 0,
                costUsd: 0,
                requests: 0,
              }
              group.tokensIn += row.tokensIn
              group.tokensOut += row.tokensOut
              group.costUsd += Number(row.costUsd)
              group.requests += 1
              groups.set(key, group)
            }
            return [...groups.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, group]) => ({ date, ...group }))
          }

          if (builder.orders.length > 0) {
            matched = [...matched].sort((a, b) => {
              for (const order of builder.orders) {
                const prop = COLUMN_TO_PROP[order.column]
                if (prop === undefined) continue
                const left = a[prop]
                const right = b[prop]
                if (left === right) continue
                const result =
                  left instanceof Date && right instanceof Date
                    ? left.getTime() - right.getTime()
                    : String(left).localeCompare(String(right))
                return order.descending ? -result : result
              }
              return 0
            })
          }

          if (builder.maxRows !== undefined) {
            matched = matched.slice(builder.skipRows, builder.skipRows + builder.maxRows)
          } else if (builder.skipRows > 0) {
            matched = matched.slice(builder.skipRows)
          }

          if (fields === undefined) return matched

          return matched.map((row: FakeRequestLogRow) => {
            const projected: Record<string, unknown> = {}
            for (const key of Object.keys(fields)) {
              const prop = COLUMN_TO_PROP[key] ?? key
              projected[key] = row[prop as keyof FakeRequestLogRow]
            }
            return projected
          })
        })

        return builder
      },
    }),

    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        if (table !== requestLogs) {
          throw new Error('fakeRequestLogDb chi ho tro bang `request_logs`')
        }
        const builder = new QueryBuilder<unknown[]>(async () => {
          counter += 1
          const row: FakeRequestLogRow = {
            id: (values['id'] as string) ?? `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
            requestId: (values['requestId'] as string) ?? `req-${counter}`,
            conversationId: (values['conversationId'] as string | null) ?? null,
            provider: (values['provider'] as string) ?? 'unknown',
            model: (values['model'] as string) ?? 'unknown',
            keySource: (values['keySource'] as string) ?? 'K1',
            promptText: (values['promptText'] as string | null) ?? null,
            contextHash: (values['contextHash'] as string | null) ?? null,
            contextSnapshot: (values['contextSnapshot'] as unknown) ?? null,
            responseText: (values['responseText'] as string | null) ?? null,
            tokensIn: (values['tokensIn'] as number) ?? 0,
            tokensOut: (values['tokensOut'] as number) ?? 0,
            costUsd: String(values['costUsd'] ?? '0'),
            ttftMs: (values['ttftMs'] as number) ?? 0,
            latencyMs: (values['latencyMs'] as number) ?? 0,
            toolCalls: (values['toolCalls'] as unknown) ?? null,
            error: (values['error'] as string | null) ?? null,
            createdAt: (values['createdAt'] as Date) ?? new Date(),
          }
          rows.push(row)
          return [row]
        })
        return builder
      },
    }),

    delete: (table: unknown) => ({
      where: (condition: unknown) => ({
        returning: async () => {
          if (table !== requestLogs) {
            throw new Error('fakeRequestLogDb chi ho tro bang `request_logs`')
          }
          const predicate = parsePredicate(condition)
          const matched = rows.filter((row) => matches(predicate, row))
          for (const row of matched) {
            const index = rows.indexOf(row)
            if (index >= 0) rows.splice(index, 1)
          }
          return matched
        },
      }),
    }),
  }

  state.db = db
  return state
}
