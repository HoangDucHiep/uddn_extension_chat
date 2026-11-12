/**
 * MCP client qua **stdio transport** (FR-TOOLS-01 — T-M2-08).
 *
 * Client spawn 1 tieng trinh MCP server → giao tiep **JSON-RPC 2.0** qua
 * stdin/stdout (newline-delimited JSON) → lay danh sach tool + goi tool.
 *
 * Nguyen tac:
 * - **Loi khong lam hong luot chat** → moi loi deu duoc bat lai thanh
 *   `McpClientError` (message tieng Viet) de manager xu ly.
 * - **Khong treo** → moi request co timeout (`MCP_LIMITS.REQUEST_TIMEOUT_MS`).
 * - **stderr khong duoc de lot vao stdout** → chi dung stdout cho framing.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.2
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { MCP_LIMITS } from '@sidekick/shared'
import {
  createRequest,
  encodeMessage,
  isJsonRpcError,
  MCP_PROTOCOL_VERSION,
  parseMessages,
  type JsonRpcResponse,
} from './protocol.js'

/** Loi cua MCP client — luon co message tieng Viet de hien thi cho user. */
export class McpClientError extends Error {
  /** Ma loi ngan — dung de phan biet trong UI. */
  readonly kind: 'spawn' | 'timeout' | 'protocol' | 'remote' | 'closed'

  constructor(kind: McpClientError['kind'], message: string) {
    super(message)
    this.name = 'McpClientError'
    this.kind = kind
  }
}

/** Tham so khoi tao client. */
export interface McpClientOptions {
  /** Lenh spawn (vd `npx` · `node`). */
  command: string
  /** Tham so truyen cho lenh. */
  args: readonly string[]
  /** Bien moi truong them cho process. */
  env: Readonly<Record<string, string>>
  /** Timeout 1 request (ms) — mac dinh `MCP_LIMITS.REQUEST_TIMEOUT_MS`. */
  requestTimeoutMs?: number | undefined
}

/** Tool do MCP server expose (shape tho cua MCP `tools/list`). */
export interface McpToolInfo {
  /** Ten goc tren MCP server. */
  name: string
  /** Mo ta (co the rong). */
  description: string
  /** JSON Schema tham so (object) — mac dinh rong neu MCP khong cung cap. */
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/** Ket qua goi 1 tool tren MCP server. */
export interface McpCallToolResult {
  /** Tool co chay thanh cong khong. */
  ok: boolean
  /** Ket qua (da flatten thanh string) hoac thong bao loi. */
  output: string
}

/** Pending request — cho phep resolve theo id khi response ve. */
interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

/**
 * Client 1 MCP server qua stdio.
 */
export class McpClient {
  private readonly options: McpClientOptions
  private readonly timeoutMs: number
  private child: ChildProcessWithoutNullStreams | undefined
  private buffer = ''
  private nextId = 1
  private readonly pending = new Map<number | string, PendingRequest>()
  /** stderr gan nhat — dung hien thi loi cho user. */
  private lastStderr = ''

  /**
   * @param options - Tham so khoi tao.
   */
  constructor(options: McpClientOptions) {
    this.options = options
    this.timeoutMs = options.requestTimeoutMs ?? MCP_LIMITS.REQUEST_TIMEOUT_MS
  }

  /** Client da connect hay chua. */
  get isConnected(): boolean {
    return this.child !== undefined && this.child.exitCode === null
  }

  /** stderr gan nhat cua process (de bao loi ro rang). */
  get stderr(): string {
    return this.lastStderr
  }

  /**
   * Spawn process + `initialize` + `notifications/initialized`.
   *
   * @throws McpClientError khi spawn that bai hoac initialize loi.
   */
  async connect(): Promise<void> {
    if (this.child !== undefined) {
      await this.disconnect()
    }

    const child = this.spawnChild()
    this.child = child

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      this.drainBuffer()
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      // Chi giu 500 ky tu cuoi → khong phinh toan bo stderr.
      this.lastStderr = `${this.lastStderr}${chunk}`.slice(-500)
    })
    child.on('error', (error: Error) => {
      this.rejectAll(new McpClientError('spawn', `Không khởi động được MCP server: ${error.message}`))
    })
    child.on('exit', (code: number | null) => {
      this.rejectAll(
        new McpClientError('closed', `MCP server đã dừng (mã ${code ?? 'null'})`),
      )
      this.child = undefined
    })

    try {
      const result = await this.request('initialize', {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'sidekick', version: '0.1.0' },
      })
      if (!isRecord(result)) {
        throw new McpClientError('protocol', 'MCP server trả về kết quả initialize sai định dạng')
      }
      // Notification (khong co id) → server chuyen sang trang thai san sang.
      this.notify('notifications/initialized', {})
    } catch (error: unknown) {
      await this.disconnect()
      if (error instanceof McpClientError) throw error
      throw new McpClientError('protocol', 'Không khởi tạo được MCP server')
    }
  }

  /**
   * Liet ke tool cua MCP server.
   *
   * @returns Danh sach tool.
   * @throws McpClientError khi MCP server tra loi khong hop le.
   */
  async listTools(): Promise<McpToolInfo[]> {
    const result = await this.request('tools/list', {})
    if (!isRecord(result) || !Array.isArray(result['tools'])) {
      throw new McpClientError('protocol', 'MCP server trả về danh sách tool sai định dạng')
    }

    const tools: McpToolInfo[] = []
    for (const raw of result['tools']) {
      if (!isRecord(raw)) continue
      const name = raw['name']
      if (typeof name !== 'string' || name.length === 0) continue

      tools.push({
        name,
        description: typeof raw['description'] === 'string' ? raw['description'] : '',
        parameters: normalizeParameters(raw['inputSchema']),
      })
    }
    return tools
  }

  /**
   * Goi 1 tool tren MCP server.
   *
   * @param name - Ten tool (goc, khong namespace).
   * @param args - Tham so.
   * @returns Ket qua (flatten thanh string).
   */
  async callTool(name: string, args: unknown): Promise<McpCallToolResult> {
    const result = await this.request('tools/call', {
      name,
      arguments: args ?? {},
    })

    if (!isRecord(result)) {
      return { ok: false, output: 'MCP server trả về kết quả gọi tool sai định dạng' }
    }

    // MCP tra `isError: true` khi tool fail → `ok: false` (khong nem loi).
    if (result['isError'] === true) {
      return { ok: false, output: flattenContent(result['content']) }
    }

    return { ok: true, output: flattenContent(result['content']) }
  }

  /**
   * Dong process + huy moi request dang cho.
   *
   * **Idempotent** — goi nhieu lan khong sao.
   */
  async disconnect(): Promise<void> {
    const child = this.child
    this.child = undefined
    this.buffer = ''

    this.rejectAll(new McpClientError('closed', 'MCP server đã được đóng'))

    if (child === undefined) return
    child.stdout.removeAllListeners('data')
    child.stderr.removeAllListeners('data')
    child.removeAllListeners('exit')
    child.removeAllListeners('error')

    if (child.exitCode === null && child.signalCode === null) {
      child.kill()
    }
  }

  /**
   * Spawn child process theo cau hinh.
   *
   * `shell: true` chi khi command la script Windows (`.cmd`/`.bat`) →
   * tranh shell injection tu `args`.
   *
   * @returns Child process.
   */
  private spawnChild(): ChildProcessWithoutNullStreams {
    const useShell = /\.(cmd|bat)$/i.test(this.options.command)
    try {
      return spawn(this.options.command, [...this.options.args], {
        env: { ...process.env, ...this.options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        ...(useShell ? { shell: true } : {}),
      }) as ChildProcessWithoutNullStreams
    } catch (error: unknown) {
      throw new McpClientError(
        'spawn',
        `Khong khoi dong duoc MCP server "${this.options.command}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  /**
   * Gui 1 request JSON-RPC va cho response.
   *
   * @param method - Ten method.
   * @param params - Tham so.
   * @returns `result` cua response.
   */
  private request(method: string, params: unknown): Promise<unknown> {
    const child = this.child
    if (child === undefined || child.stdin.destroyed) {
      return Promise.reject(new McpClientError('closed', 'MCP server chưa kết nối'))
    }

    const id = this.nextId
    this.nextId += 1

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(
          new McpClientError(
            'timeout',
            `MCP server không phản hồi "${method}" trong ${this.timeoutMs}ms`,
          ),
        )
      }, this.timeoutMs)
      // Timeout khong giu process alive.
      timer.unref?.()

      this.pending.set(id, { resolve, reject, timer })

      try {
        child.stdin.write(encodeMessage(createRequest(id, method, params)))
      } catch (error: unknown) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(
          new McpClientError(
            'protocol',
            `Khong gui duoc request "${method}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        )
      }
    })
  }

  /**
   * Gui 1 notification (khong co id → server khong tra loi).
   *
   * @param method - Ten method.
   * @param params - Tham so.
   */
  private notify(method: string, params: unknown): void {
    const child = this.child
    if (child === undefined || child.stdin.destroyed) return
    child.stdin.write(
      encodeMessage({
        jsonrpc: '2.0',
        method,
        params,
      } as never),
    )
  }

  /**
   * Doc buffer stdout → tach message → resolve pending request.
   */
  private drainBuffer(): void {
    const newlineIndex = this.buffer.indexOf('\n')
    if (newlineIndex < 0) return

    const chunk = this.buffer.slice(0, newlineIndex)
    this.buffer = this.buffer.slice(newlineIndex + 1)

    for (const message of parseMessages(`${chunk}\n`)) {
      this.handleMessage(message)
    }

    // Buffer con lai co the chua nhieu dong → xu tiep.
    if (this.buffer.includes('\n')) this.drainBuffer()
  }

  /**
   * Xu ly 1 response JSON-RPC → resolve/reject request tuong ung.
   *
   * @param message - Response nhan duoc.
   */
  private handleMessage(message: JsonRpcResponse): void {
    const id = message.id
    if (id === null) return

    const entry = this.pending.get(id)
    if (entry === undefined) return
    this.pending.delete(id)
    clearTimeout(entry.timer)

    if (isJsonRpcError(message)) {
      entry.reject(
        new McpClientError('remote', `MCP server loi: ${message.error.message}`),
      )
      return
    }

    entry.resolve(message.result)
  }

  /**
   * Reject moi request dang cho (process vua dung / bi dong).
   *
   * @param error - Loi truyen cho caller.
   */
  private rejectAll(error: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
      this.pending.delete(id)
    }
  }
}

/**
 * Kiem tra gia tri co phai object khong.
 *
 * @param value - Gia tri can kiem tra.
 * @returns `true` neu la object (khong phai null, khong phai array).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Chuan hoa JSON Schema tham so cua MCP tool.
 *
 * MCP spec cho phep `inputSchema` bat ky → nhung provider (OpenAI) chi nhan
 * shape `object` → ep ve object, phan tu khong phai object thi bo qua.
 *
 * @param value - `inputSchema` tho.
 * @returns Shape chuan hoa.
 */
function normalizeParameters(value: unknown): McpToolInfo['parameters'] {
  if (!isRecord(value)) {
    return { type: 'object', properties: {} }
  }

  const properties = isRecord(value['properties']) ? value['properties'] : {}
  const required = Array.isArray(value['required'])
    ? value['required'].filter((item): item is string => typeof item === 'string')
    : undefined

  return {
    type: 'object',
    properties,
    ...(required !== undefined && required.length > 0 ? { required } : {}),
  }
}

/**
 * Flatten `content` cua MCP tool thanh string.
 *
 * MCP tra content la mang block (`text` · `resource` · ...) → noi text lai.
 *
 * @param value - `content` tho.
 * @returns Chuoi de gui lai cho model.
 */
function flattenContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''

  const parts: string[] = []
  for (const block of value) {
    if (!isRecord(block)) continue
    if (typeof block['text'] === 'string') {
      parts.push(block['text'])
      continue
    }
    if (typeof block['type'] === 'string') {
      parts.push(`[${block['type']}]`)
    }
  }
  return parts.join('\n')
}
