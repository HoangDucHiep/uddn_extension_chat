/**
 * Fake Drizzle DB cho unit test â€” chi mo phong bang `mcp_servers`.
 *
 * BFF thuc te dung Postgres 16, nhung unit test phai chay **khong can Docker**
 * â†’ fake o day mo phong chuoi goi Drizzle ma `mcpService` su dung:
 *
 * ```ts
 * db.select().from(mcpServers).orderBy(asc(mcpServers.name))
 * db.select().from(mcpServers).where(eq(mcpServers.id, id)).limit(1)
 * db.insert(mcpServers).values({...}).returning()
 * db.update(mcpServers).set({...}).where(eq(mcpServers.id, id)).returning()
 * db.delete(mcpServers).where(eq(mcpServers.id, id)).returning()
 * ```
 *
 * Filter duoc phan tich tu **cau truc SQL chunk** cua Drizzle (khong hardcode
 * chuoi SQL) â†’ phan anh `eq` that.
 *
 * Docs: docs/SYSTEM_DESIGN.md Â§5
 */

/** Mot dong trong bang `mcp_servers`. */
export interface FakeMcpServerRow {
  id: string
  name: string
  transport: string
  command: string
  args: string[]
  env: unknown
  enabled: boolean
  autoApprove: boolean
  lastConnectedAt: Date | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
}

/** Map ten cot DB (snake_case) sang ten truong TS (camelCase). */
const MCP_COLUMN_TO_PROP: Record<string, keyof FakeMcpServerRow> = {
  id: 'id',
  name: 'name',
  transport: 'transport',
  command: 'command',
  args: 'args',
  env: 'env',
  enabled: 'enabled',
  auto_approve: 'autoApprove',
  last_connected_at: 'lastConnectedAt',
  last_error: 'lastError',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
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
 * Trich gia tri so sanh tu dieu kien Drizzle (`eq`).
 *
 * @param condition - Dieu kien Drizzle.
 * @returns `{ column, value }` hoac `null` neu khong doc duoc.
 */
function parseEquality(condition: unknown): { column: string; value: unknown } | undefined {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks
  if (!Array.isArray(chunks)) return undefined

  const column = chunks.find((chunk) => isColumn(chunk))
  if (column === undefined) return undefined

  const param = chunks.find((chunk) => isParam(chunk))
  if (param === undefined) return undefined

  return { column: column.name, value: param.value }
}

/**
 * Trich thu tu sap xep tu mot chunk `asc`/`desc` cua Drizzle.
 *
 * @param order - Chunk order.
 * @returns `{ column, descending }`.
 */
function parseOrder(order: unknown): { column: string; descending: boolean } {
  const chunks = (order as { queryChunks?: unknown[] }).queryChunks
  const result = { column: '', descending: false }
  if (!Array.isArray(chunks)) return result

  for (const chunk of chunks) {
    if (isColumn(chunk)) {
      result.column = chunk.name
      continue
    }
    const values = (chunk as { value?: unknown }).value
    if (Array.isArray(values)) {
      const text = values.join('').trim().toLowerCase()
      if (text === 'desc') result.descending = true
    }
  }
  return result
}

/** Builder co the `await` duoc â€” moi method tra ve chinh no (de chain). */
class QueryBuilder<T> implements PromiseLike<T> {
  /** Dieu kien loc. */
  condition: unknown = undefined
  /** Thu tu sap xep. */
  orders: Array<{ column: string; descending: boolean }> = []
  /** So row toi da tra ve (cho `limit`). */
  limitCount: number | undefined

  constructor(private readonly run: () => Promise<T>) {}

  where(condition: unknown): QueryBuilder<T> {
    this.condition = condition
    return this
  }

  orderBy(...orders: unknown[]): QueryBuilder<T> {
    this.orders = orders.flatMap((order) => {
      const parsed = parseOrder(order)
      return parsed.column.length > 0 ? [parsed] : []
    })
    return this
  }

  limit(count: number): QueryBuilder<T> {
    this.limitCount = count
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

/** Fake DB cho bang `mcp_servers`. */
export interface FakeMcpDb {
  /** Cac dong `mcp_servers`. */
  mcpServerRows: FakeMcpServerRow[]
  /** DB gia lap cho Drizzle. */
  db: unknown
  /** Them MCP server truc tiep (test setup). */
  seedMcpServer: (row: Partial<FakeMcpServerRow>) => FakeMcpServerRow
}

/** Bo dem id cho MCP server (uuid gia lap cho route test). */
let mcpServerCounter = 0

/**
 * Tao fake DB cho bang `mcp_servers`.
 *
 * @param initial - Du lieu khoi tao.
 */
export function createFakeMcpDb(
  initial: { mcpServers?: FakeMcpServerRow[] } = {},
): FakeMcpDb {
  const mcpServerRows: FakeMcpServerRow[] = [...(initial.mcpServers ?? [])]

  const state: FakeMcpDb = {
    mcpServerRows,
    db: undefined,
    seedMcpServer: (row) => {
      mcpServerCounter += 1
      const full: FakeMcpServerRow = {
        id: row.id ?? `00000000-0000-4000-8000-${String(mcpServerCounter).padStart(12, '0')}`,
        name: row.name ?? `mcp-${mcpServerCounter}`,
        transport: row.transport ?? 'stdio',
        command: row.command ?? 'node',
        args: row.args ?? [],
        env: row.env ?? {},
        enabled: row.enabled ?? true,
        autoApprove: row.autoApprove ?? false,
        lastConnectedAt: row.lastConnectedAt ?? null,
        lastError: row.lastError ?? null,
        createdAt: row.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: row.updatedAt ?? new Date('2026-01-01T00:00:00.000Z'),
      }
      mcpServerRows.push(full)
      return full
    },
  }

  /**
   * Loc dong theo dieu kien.
   *
   * @param condition - Dieu kien Drizzle.
   * @returns Mang dong khop.
   */
  const filter = (condition: unknown): FakeMcpServerRow[] => {
    if (condition === undefined) return [...mcpServerRows]
    const parsed = parseEquality(condition)
    if (parsed === undefined) return [...mcpServerRows]
    const prop = MCP_COLUMN_TO_PROP[parsed.column]
    if (prop === undefined) return [...mcpServerRows]
    return mcpServerRows.filter((row) => row[prop] === parsed.value)
  }

  const db = {
    select: (fields?: Record<string, unknown>) => ({
      from: (_table: unknown) => {
        const builder = new QueryBuilder<unknown[]>(async () => {
          let rows = filter(builder.condition)

          if (builder.orders.length > 0) {
            rows = [...rows].sort((a, b) => {
              for (const order of builder.orders) {
                const prop = MCP_COLUMN_TO_PROP[order.column]
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

          if (builder.limitCount !== undefined) rows = rows.slice(0, builder.limitCount)

          if (fields === undefined) return rows as unknown[]

          return rows.map((row) => {
            const projected: Record<string, unknown> = {}
            for (const key of Object.keys(fields)) {
              const prop = MCP_COLUMN_TO_PROP[key]
              projected[key] = prop === undefined ? row[key as never] : row[prop]
            }
            return projected
          })
        })

        return builder
      },
    }),

    insert: (_table: unknown) => ({
      values: (values: Record<string, unknown> | Array<Record<string, unknown>>) => {
        const valueRows = Array.isArray(values) ? values : [values]
        const builder = new QueryBuilder<unknown[]>(async () => {
          const inserted: FakeMcpServerRow[] = []
          for (const value of valueRows) {
            const row: FakeMcpServerRow = {
              id:
                (value['id'] as string) ??
                `00000000-0000-4000-8000-${String(mcpServerRows.length + 1).padStart(12, '0')}`,
              name: (value['name'] as string) ?? '',
              transport: (value['transport'] as string) ?? 'stdio',
              command: (value['command'] as string) ?? '',
              args: (value['args'] as string[]) ?? [],
              env: value['env'] ?? {},
              enabled: (value['enabled'] as boolean) ?? true,
              autoApprove: (value['autoApprove'] as boolean) ?? false,
              lastConnectedAt: (value['lastConnectedAt'] as Date | null) ?? null,
              lastError: (value['lastError'] as string | null) ?? null,
              createdAt: (value['createdAt'] as Date) ?? new Date(),
              updatedAt: (value['updatedAt'] as Date) ?? new Date(),
            }
            mcpServerRows.push(row)
            inserted.push(row)
          }
          return inserted as unknown[]
        })
        return builder
      },
    }),

    update: (_table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => ({
          returning: async () => {
            const rows = filter(condition)
            for (const row of rows) {
              const record = row as unknown as Record<string, unknown>
              for (const [key, value] of Object.entries(values)) {
                record[key] = value
              }
            }
            return rows as unknown[]
          },
        }),
      }),
    }),

    delete: (_table: unknown) => ({
      where: (condition: unknown) => ({
        returning: async () => {
          const rows = filter(condition)
          for (const row of rows) {
            const index = mcpServerRows.indexOf(row)
            if (index >= 0) mcpServerRows.splice(index, 1)
          }
          return rows as unknown[]
        },
      }),
    }),
  }

  state.db = db
  return state
}
