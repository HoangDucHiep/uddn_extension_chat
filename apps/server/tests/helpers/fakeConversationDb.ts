/**
 * Fake Drizzle DB cho unit test — ho tro bang `conversations` + `messages`
 * + `citations`.
 *
 * BFF thuc te dung Postgres 16, nhung unit test phai chay **khong can Docker**
 * → fake o day mo phong chuoi goi Drizzle ma `conversationService` su dung:
 *
 * ```ts
 * db.select(...).from(...).where(...).orderBy(...)      // await duoc
 * db.select(...).from(...).where(...).groupBy(...)      // count theo nhom
 * db.insert(...).values(...).returning()
 * db.update(...).set(...).where(...).returning()
 * db.delete(...).where(...).returning()
 * ```
 *
 * Filter duoc phan tich tu **cau truc SQL chunk** cua Drizzle (khong hardcode
 * chuoi SQL) → test phan anh `eq` / `ilike` / `inArray` / `and` / `or` that.
 *
 * Docs: docs/SYSTEM_DESIGN.md §5
 */

import type { citations } from '../../src/db/schema.js'
import { conversations, messages } from '../../src/db/schema.js'

/** Mot dong trong bang `conversations`. */
export interface FakeConversationRow {
  id: string
  title: string
  pinned: boolean
  archived: boolean
  meta: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

/** Mot dong trong bang `messages`. */
export interface FakeMessageRow {
  id: string
  conversationId: string
  role: string
  content: string
  meta: Record<string, unknown>
  createdAt: Date
}

/** Mot dong trong bang `citations`. */
export interface FakeCitationRow {
  id: string
  messageId: string
  idx: number
  url: string
  title: string
  snippet: string
  tabId: number | null
  score: number | null
  createdAt: Date
}

/** Map ten cot DB (snake_case) sang ten truong TS (camelCase). */
const CONVERSATION_COLUMN_TO_PROP: Record<string, keyof FakeConversationRow> = {
  id: 'id',
  title: 'title',
  pinned: 'pinned',
  archived: 'archived',
  meta: 'meta',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
}

const MESSAGE_COLUMN_TO_PROP: Record<string, keyof FakeMessageRow> = {
  id: 'id',
  conversation_id: 'conversationId',
  role: 'role',
  content: 'content',
  meta: 'meta',
  created_at: 'createdAt',
}

const CITATION_COLUMN_TO_PROP: Record<string, keyof FakeCitationRow> = {
  id: 'id',
  message_id: 'messageId',
  idx: 'idx',
  url: 'url',
  title: 'title',
  snippet: 'snippet',
  tab_id: 'tabId',
  score: 'score',
  created_at: 'createdAt',
}

/** Bang nguon cua fake. */
type FakeTable = typeof conversations | typeof messages | typeof citations

/** Cay dieu kien da phan tich tu SQL chunk. */
type Predicate =
  | { kind: 'and'; children: Predicate[] }
  | { kind: 'or'; children: Predicate[] }
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
 * Kiem tra chunk co phai chuoi thuoc (dung cho `ilike` — gia tri la string
 * tho, khong phai `Param`).
 *
 * @param chunk - Chunk can kiem tra.
 */
function isRawString(chunk: unknown): chunk is string {
  return typeof chunk === 'string'
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
 * Phan tich SQL chunk cua Drizzle thanh cay dieu kien.
 *
 * Cau truc Drizzle:
 * - So sanh: `SQL { Col x, Str " = ", Param v }`
 * - Nhom: `SQL { SQL{...}, Str " and ", SQL{...} }`
 *
 * @param node - Node SQL/condition can phan tich.
 * @returns Cay dieu kien.
 */
function parsePredicate(node: unknown): Predicate {
  if (node === undefined || node === null) return { kind: 'and', children: [] }

  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return { kind: 'and', children: [] }

  // Node co `Column` o cap hien tai → day la so sanh don gian.
  const columnChunk = chunks.find((chunk) => isColumn(chunk))
  if (columnChunk !== undefined) {
    let op = ''
    let value: unknown

    for (const chunk of chunks) {
      if (isColumn(chunk)) continue
      if (isStringChunk(chunk)) {
        op += chunk.value.join('')
        continue
      }
      if (isParam(chunk)) {
        value = chunk.value
        continue
      }
      if (isRawString(chunk)) {
        value = chunk
        continue
      }
      if (Array.isArray(chunk)) {
        value = chunk.map((entry) =>
          isParam(entry) ? entry.value : (entry as { value?: unknown }).value,
        )
      }
    }

    return {
      kind: 'cmp',
      column: columnChunk.name,
      op: op.trim(),
      values: value === undefined ? [] : [value],
    }
  }

  // Node nhom → tach theo separator ` and ` / ` or `.
  const groups: Array<{ separator: string; items: unknown[] }> = []
  let currentItems: unknown[] = []
  let nextSeparator = 'and'

  for (const chunk of chunks) {
    if (isStringChunk(chunk)) {
      const text = chunk.value.join('').trim()
      if (text === 'and' || text === 'or') {
        if (currentItems.length > 0) {
          groups.push({ separator: nextSeparator, items: currentItems })
        }
        currentItems = []
        nextSeparator = text
        continue
      }
      // Dau ngoac / khoang trang → bo qua.
      continue
    }
    currentItems.push(chunk)
  }
  if (currentItems.length > 0) {
    groups.push({ separator: nextSeparator, items: currentItems })
  }

  if (groups.length === 0) return { kind: 'and', children: [] }
  if (groups.length === 1) {
    return parseTerm(groups[0]?.items ?? [])
  }

  // Separator giữa 2 nhom la separator cua nhom thu 2.
  const children = groups.map((group) => parseTerm(group.items))
  const separators = groups.map((group) => group.separator)

  // Gom cac nhom theo separator → `and`/`or` lan nhau.
  return combineGroups(children, separators)
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
      // `or` ghep vao nhom cuoi cung (phai la `and` de ghep dung).
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
 * Phan tich mot nhom chunk thanh dieu kien.
 *
 * @param items - Cac chunk cua nhom.
 */
function parseTerm(items: readonly unknown[]): Predicate {
  // Nhom chi co 1 phan tu → co the la SQL long nhau → recurse.
  if (items.length === 1) {
    const only = items[0]
    if (only !== undefined && only !== null && typeof only === 'object' && 'queryChunks' in only) {
      return parsePredicate(only)
    }
  }

  // Nhom nhieu chunk → so sanh tren cap hien tai.
  const columnChunk = items.find((chunk) => isColumn(chunk))
  if (columnChunk === undefined) return { kind: 'and', children: [] }

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
    if (isRawString(chunk)) {
      value = chunk
      continue
    }
    if (Array.isArray(chunk)) {
      value = chunk.map((entry) =>
        isParam(entry) ? entry.value : (entry as { value?: unknown }).value,
      )
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
 * Danh gia dieu kien tren 1 dong.
 *
 * @param predicate - Cay dieu kien.
 * @param row - Dong can kiem tra.
 * @param columnToProp - Map ten cot → ten truong.
 */
function matches(
  predicate: Predicate,
  row: Record<string, unknown>,
  columnToProp: Record<string, string>,
): boolean {
  if (predicate.kind === 'and') {
    return predicate.children.every((child) => matches(child, row, columnToProp))
  }
  if (predicate.kind === 'or') {
    return predicate.children.some((child) => matches(child, row, columnToProp))
  }

  const prop = columnToProp[predicate.column]
  if (prop === undefined) return true

  const actual = row[prop]
  const [expected] = predicate.values
  if (expected === undefined) return true

  if (predicate.op.includes('ilike') || predicate.op.includes('like')) {
    const pattern = String(expected).replace(/%/g, '').toLowerCase()
    return String(actual ?? '').toLowerCase().includes(pattern)
  }
  if (predicate.op.includes('in')) {
    // `inArray` → gia tri la mang.
    if (Array.isArray(expected)) {
      return expected.includes(actual)
    }
    return predicate.values.some((value) => value === actual)
  }
  if (predicate.op.includes('!=') || predicate.op.includes('<>')) {
    return actual !== expected
  }
  return actual === expected
}

/** Mot sap xep da trich tu `orderBy`. */
interface OrderSpec {
  column: string
  descending: boolean
}

/**
 * Builder co the `await` duoc — moi method tra ve chinh no (de chain).
 *
 * Chuoi goi Drizzle: `select().from().where().orderBy().limit()` → moi
 * method chi giu state, du lieu thuc tra khi `await`.
 */
class QueryBuilder<T> implements PromiseLike<T> {
  /** Dieu kien loc. */
  condition: unknown = undefined
  /** Thu tu sap xep. */
  orders: OrderSpec[] = []
  /** Query co gom nhom hay khong. */
  isGrouped = false

  constructor(private readonly run: () => Promise<T>) {}

  where(condition: unknown): QueryBuilder<T> {
    this.condition = condition
    return this
  }

  orderBy(...orders: unknown[]): QueryBuilder<T> {
    this.orders = orders.flatMap((order) => parseOrder(order))
    return this
  }

  limit(_count: number): QueryBuilder<T> {
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
function parseOrder(order: unknown): OrderSpec[] {
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

/** Fake DB cho CRUD conversation. */
export interface FakeConversationDb {
  /** Cac dong `conversations`. */
  conversationRows: FakeConversationRow[]
  /** Cac dong `messages`. */
  messageRows: FakeMessageRow[]
  /** Cac dong `citations`. */
  citationRows: FakeCitationRow[]
  /** DB gia lap cho Drizzle. */
  db: unknown
  /** Them conversation truc tiep (test setup). */
  seedConversation: (row: Partial<FakeConversationRow>) => FakeConversationRow
  /** Them message truc tiep (test setup). */
  seedMessage: (row: Partial<FakeMessageRow>) => FakeMessageRow
  /** Them citation truc tiep (test setup). */
  seedCitation: (row: Partial<FakeCitationRow>) => FakeCitationRow
}

/**
 * Tao fake DB cho bang `conversations` + `messages` + `citations`.
 *
 * @param initial - Du lieu khoi tao.
 */
export function createFakeConversationDb(
  initial: {
    conversations?: FakeConversationRow[]
    messages?: FakeMessageRow[]
    citations?: FakeCitationRow[]
  } = {},
): FakeConversationDb {
  const conversationRows: FakeConversationRow[] = [...(initial.conversations ?? [])]
  const messageRows: FakeMessageRow[] = [...(initial.messages ?? [])]
  const citationRows: FakeCitationRow[] = [...(initial.citations ?? [])]

  let conversationCounter = 0
  let messageCounter = 0
  let citationCounter = 0

  const state: FakeConversationDb = {
    conversationRows,
    messageRows,
    citationRows,
    db: undefined,
    seedConversation: (row) => {
      conversationCounter += 1
      const full: FakeConversationRow = {
        id: row.id ?? `conv-${conversationCounter}`,
        title: row.title ?? 'Cuộc trò chuyện mới',
        pinned: row.pinned ?? false,
        archived: row.archived ?? false,
        meta: row.meta ?? {},
        createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: row.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
      }
      conversationRows.push(full)
      return full
    },
    seedMessage: (row) => {
      messageCounter += 1
      const full: FakeMessageRow = {
        id: row.id ?? `msg-${messageCounter}`,
        conversationId: row.conversationId ?? 'conv-1',
        role: row.role ?? 'user',
        content: row.content ?? '',
        meta: row.meta ?? {},
        createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      }
      messageRows.push(full)
      return full
    },
    seedCitation: (row) => {
      citationCounter += 1
      const full: FakeCitationRow = {
        id: row.id ?? `cite-${citationCounter}`,
        messageId: row.messageId ?? 'msg-1',
        idx: row.idx ?? 1,
        url: row.url ?? '',
        title: row.title ?? '',
        snippet: row.snippet ?? '',
        tabId: row.tabId ?? null,
        score: row.score ?? null,
        createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      }
      citationRows.push(full)
      return full
    },
  }

  /** Chuoi de sinh id conversation hieu luc (uuid gia lap cho route test). */
  const nextUuid = (): string => {
    conversationCounter += 1
    return `00000000-0000-4000-8000-${String(conversationCounter).padStart(12, '0')}`
  }

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: FakeTable) => {
        const source = resolveSource(table, state)

        const builder: QueryBuilder<unknown[]> = new QueryBuilder<unknown[]>(
          async () => runSelect(source, builder, fields),
        )

        return builder
      },
    }),

    insert: (table: FakeTable) => ({
      values: (values: Record<string, unknown>) => {
        const source = resolveSource(table, state)
        const builder = new QueryBuilder<unknown[]>(async () => {
          if (source.table === conversations) {
            const row: FakeConversationRow = {
              id: (values['id'] as string) ?? nextUuid(),
              title: (values['title'] as string) ?? 'Cuộc trò chuyện mới',
              pinned: (values['pinned'] as boolean) ?? false,
              archived: (values['archived'] as boolean) ?? false,
              meta: (values['meta'] as Record<string, unknown>) ?? {},
              createdAt: (values['createdAt'] as Date) ?? new Date(),
              updatedAt: (values['updatedAt'] as Date) ?? new Date(),
            }
            conversationRows.push(row)
            return [row]
          }

          if (source.table === messages) {
            const row: FakeMessageRow = {
              id: (values['id'] as string) ?? `msg-${++messageCounter}`,
              conversationId: (values['conversationId'] as string) ?? '',
              role: (values['role'] as string) ?? 'user',
              content: (values['content'] as string) ?? '',
              meta: (values['meta'] as Record<string, unknown>) ?? {},
              createdAt: (values['createdAt'] as Date) ?? new Date(),
            }
            messageRows.push(row)
            return [row]
          }

          const row: FakeCitationRow = {
            id: (values['id'] as string) ?? `cite-${++citationCounter}`,
            messageId: (values['messageId'] as string) ?? '',
            idx: (values['idx'] as number) ?? 0,
            url: (values['url'] as string) ?? '',
            title: (values['title'] as string) ?? '',
            snippet: (values['snippet'] as string) ?? '',
            tabId: (values['tabId'] as number | null) ?? null,
            score: (values['score'] as number | null) ?? null,
            createdAt: (values['createdAt'] as Date) ?? new Date(),
          }
          citationRows.push(row)
          return [row]
        })

        // Chat service goi `.onConflictDoNothing()` truoc `.returning()`.
        const withConflict = Object.assign(builder, {
          onConflictDoNothing: () => builder,
        })
        return withConflict
      },
    }),

    update: (table: FakeTable) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            const source = resolveSource(table, state)
            const rows = source.rows.filter((row) =>
              matches(
                parsePredicate(condition),
                row as unknown as Record<string, unknown>,
                source.columnToProp,
              ),
            )
            for (const row of rows) {
              const record = row as unknown as Record<string, unknown>
              for (const [key, value] of Object.entries(values)) {
                record[key] = value
              }
            }
            return rows
          },
        }),
      }),
    }),

    delete: (table: FakeTable) => ({
      where: (condition: unknown) => ({
        returning: async () => {
          const source = resolveSource(table, state)
          const matched = source.rows.filter((row) =>
            matches(
              parsePredicate(condition),
              row as unknown as Record<string, unknown>,
              source.columnToProp,
            ),
          )
          for (const row of matched) {
            const index = source.rows.indexOf(row)
            if (index >= 0) source.rows.splice(index, 1)
          }
          return matched
        },
      }),
    }),
  }

  state.db = db
  return state
}

/** Nguon du lieu cua 1 bang trong fake. */
interface Source {
  table: FakeTable
  rows: unknown[]
  columnToProp: Record<string, string>
}

/**
 * Chay 1 query `select` tren fake (loc → dem nhom → sort → project).
 *
 * @param source - Nguon du lieu cua bang.
 * @param builder - Builder giu state (condition / orders / grouped).
 * @param fields - Cot duoc chon (undefined = lay het).
 */
async function runSelect(
  source: Source,
  builder: QueryBuilder<unknown[]>,
  fields: Record<string, unknown> | undefined,
): Promise<unknown[]> {
  const columnToProp = source.columnToProp
  const condition = builder.condition
  const orders = builder.orders
  const grouped = builder.isGrouped

  let rows = source.rows.filter((row) =>
    condition === undefined
      ? true
      : matches(
          parsePredicate(condition),
          row as unknown as Record<string, unknown>,
          columnToProp,
        ),
  )

  if (grouped && fields !== undefined && 'total' in fields) {
    // Query dem theo nhom (`count` + `groupBy`).
    const groups = new Map<string, number>()
    for (const row of rows) {
      const key = String((row as unknown as Record<string, unknown>)['conversationId'] ?? '')
      groups.set(key, (groups.get(key) ?? 0) + 1)
    }
    return [...groups.entries()].map(([conversationId, total]) => ({ conversationId, total }))
  }

  if (orders.length > 0) {
    rows = [...rows].sort((a, b) => {
      for (const order of orders) {
        const prop = columnToProp[order.column]
        if (prop === undefined) continue
        const left = (a as unknown as Record<string, unknown>)[prop]
        const right = (b as unknown as Record<string, unknown>)[prop]
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

  if (fields === undefined) return rows

  return rows.map((row) => {
    const projected: Record<string, unknown> = {}
    for (const key of Object.keys(fields)) {
      const prop = columnToProp[key] ?? key
      projected[key] = (row as unknown as Record<string, unknown>)[prop]
    }
    return projected
  })
}

/**
 * Xac dinh nguon du lieu theo bang Drizzle.
 *
 * @param table - Bang can tra.
 * @param state - Mang du lieu cua fake.
 */
function resolveSource(table: FakeTable, state: FakeConversationDb): Source {
  if (table === conversations) {
    return {
      table,
      rows: state.conversationRows as unknown[],
      columnToProp: CONVERSATION_COLUMN_TO_PROP as Record<string, string>,
    }
  }
  if (table === messages) {
    return {
      table,
      rows: state.messageRows as unknown[],
      columnToProp: MESSAGE_COLUMN_TO_PROP as Record<string, string>,
    }
  }
  return {
    table,
    rows: state.citationRows as unknown[],
    columnToProp: CITATION_COLUMN_TO_PROP as Record<string, string>,
  }
}
