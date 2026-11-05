/**
 * Fake Drizzle DB cho unit test — chi ho tro bang `provider_keys`.
 *
 * BFF thuc te dung Postgres 16, nhung unit test phai chay **khong can Docker**
 * → fake o day mo phong dung chuoi goi Drizzle ma `providerService` su dung:
 *
 * ```ts
 * db.select(...).from(...).where(...).orderBy(...)  // await duoc
 * db.insert(...).values(...).onConflictDoUpdate(...).returning()
 * db.delete(...).where(...).returning(...)
 * ```
 *
 * Bo qua moi thao tac DB khac — dung sai se nem loi ro rang.
 *
 * Docs: docs/SYSTEM_DESIGN.md §5
 */

/** Mot ban ghi trong bang `provider_keys`. */
export interface FakeProviderKeyRow {
  id: string
  providerId: string
  label: string
  ciphertext: string
  iv: string
  authTag: string
  hint: string
  isActive: boolean
  createdAt: Date
  lastUsedAt: Date | null
}

/**
 * Map ten cot trong Postgres (snake_case) sang ten truong cua object trong
 * TypeScript (camelCase).
 */
const COLUMN_TO_PROP: Record<string, keyof FakeProviderKeyRow> = {
  id: 'id',
  provider_id: 'providerId',
  label: 'label',
  ciphertext: 'ciphertext',
  iv: 'iv',
  auth_tag: 'authTag',
  hint: 'hint',
  is_active: 'isActive',
  created_at: 'createdAt',
  last_used_at: 'lastUsedAt',
}

/** Cap `column = value` doc duoc tu SQL object cua Drizzle. */
interface ColumnFilter {
  column: string
  value: unknown
}

/**
 * Rut cac cap `column = value` tu mot SQL object cua Drizzle.
 *
 * Drizzle bien `eq(col, value)` thanh `queryChunks` gom `Column` + `Param`,
 * nen quet de tim `name` cua column va `value` cua param.
 */
function extractFilters(condition: unknown): ColumnFilter[] {
  const filters: ColumnFilter[] = []
  let lastColumn = ''

  visit(condition)
  return filters

  function visit(node: unknown): void {
    if (node === null || node === undefined) return

    if (Array.isArray(node)) {
      for (const item of node) visit(item)
      return
    }

    if (typeof node !== 'object') return

    const record = node as Record<string, unknown>
    const constructorName = (record['constructor'] as { name?: string } | undefined)?.name

    if (constructorName === 'Param') {
      // `Param` giu gia tri so sanh — can cot tu chunk truoc do.
      filters.push({ column: lastColumn, value: record['value'] })
      return
    }

    if (typeof record['name'] === 'string' && 'table' in record) {
      lastColumn = record['name']
    }

    if (Array.isArray(record['queryChunks'])) {
      visit(record['queryChunks'])
    }
  }
}

/** Ap dung cac filter len danh sach row. */
function applyFilters(rows: FakeProviderKeyRow[], filters: ColumnFilter[]): FakeProviderKeyRow[] {
  if (filters.length === 0) return rows
  return rows.filter((row) =>
    filters.every((filter) => {
      const prop = COLUMN_TO_PROP[filter.column]
      if (!prop) return true
      return row[prop] === filter.value
    }),
  )
}

/** Builder co the `await` duoc — moi method tra ve chinh no (de chain). */
class QueryBuilder<T> implements PromiseLike<T> {
  constructor(private readonly run: () => Promise<T>) {}

  where(_condition: unknown): QueryBuilder<T> {
    return this
  }

  orderBy(_order: unknown): QueryBuilder<T> {
    return this
  }

  limit(_count: number): QueryBuilder<T> {
    return this
  }

  onConflictDoUpdate(_config: unknown): QueryBuilder<T> {
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

export interface FakeProviderKeyDb {
  /** Goc du lieu — de kiem tra trang thai sau khi service ghi. */
  rows: FakeProviderKeyRow[]
  /** Troi cap so ban ghi toi da duoc (de kiem tra upsert khong tao ban trung). */
  insertCount: number
  /** DB gia lap cho Drizzle. */
  db: unknown
  /** them ban ghi truc tiep (test setup). */
  seed: (row: Partial<FakeProviderKeyRow>) => FakeProviderKeyRow
}

/**
 * Tao fake DB cho bang `provider_keys`.
 *
 * @param initialRows - Ban ghi co san (mac dinh rong).
 */
export function createFakeProviderKeyDb(initialRows: FakeProviderKeyRow[] = []): FakeProviderKeyDb {
  const rows: FakeProviderKeyRow[] = [...initialRows]
  let insertCount = 0
  let idCounter = 0

  const state: FakeProviderKeyDb = {
    rows,
    get insertCount() {
      return insertCount
    },
    seed: (row) => {
      idCounter += 1
      const full: FakeProviderKeyRow = {
        id: row.id ?? `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
        providerId: row.providerId ?? 'groq',
        label: row.label ?? 'default',
        ciphertext: row.ciphertext ?? '',
        iv: row.iv ?? '',
        authTag: row.authTag ?? '',
        hint: row.hint ?? '',
        isActive: row.isActive ?? true,
        createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
        lastUsedAt: row.lastUsedAt ?? null,
      }
      rows.push(full)
      return full
    },
    db: undefined,
  }

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (_table: unknown) => ({
        where: (condition: unknown) =>
          new QueryBuilder(async () => {
            const filtered = applyFilters(rows, extractFilters(condition))
            if (!fields) return filtered
            // Chi giu cac cot duoc chon.
            return filtered.map((row) => {
              const projected: Record<string, unknown> = {}
              for (const key of Object.keys(fields)) {
                projected[key] = row[key as keyof FakeProviderKeyRow]
              }
              return projected
            })
          }),
      }),
    }),

    insert: (_table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: (_config: {
          target: unknown[]
          set: Record<string, unknown>
        }) => ({
          returning: () =>
            new QueryBuilder(async () => {
              insertCount += 1
              const set = _config.set
              const providerId = values['providerId']
              const label = values['label']

              // Upsert theo `(provider_id, label)`.
              const existing = rows.find(
                (row) => row.providerId === providerId && row.label === label,
              )

              if (existing) {
                Object.assign(existing, set)
                return [existing]
              }

              idCounter += 1
              const created: FakeProviderKeyRow = {
                id: `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
                providerId: (providerId as string) ?? 'groq',
                label: (label as string) ?? 'default',
                ciphertext: (values['ciphertext'] as string) ?? '',
                iv: (values['iv'] as string) ?? '',
                authTag: (values['authTag'] as string) ?? '',
                hint: (values['hint'] as string) ?? '',
                isActive: true,
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
                lastUsedAt: null,
              }
              rows.push(created)
              return [created]
            }),
        }),
      }),
    }),

    delete: (_table: unknown) => ({
      where: (condition: unknown) => ({
        returning: () =>
          new QueryBuilder(async () => {
            const filtered = applyFilters(rows, extractFilters(condition))
            for (const row of filtered) {
              const index = rows.indexOf(row)
              if (index >= 0) rows.splice(index, 1)
            }
            return filtered.map((row) => ({ id: row.id }))
          }),
      }),
    }),
  }

  state.db = db
  return state
}
