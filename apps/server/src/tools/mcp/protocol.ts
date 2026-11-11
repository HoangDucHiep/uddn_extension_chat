/**
 * Framing **JSON-RPC 2.0** cho MCP stdio transport (FR-TOOLS-01 — T-M2-08).
 *
 * MCP stdio dung **newline-delimited JSON**: moi message la 1 dong JSON
 * ket thuc bang `\n`. Khong co `Content-Length` header (khac voi LSP).
 *
 * Module nay **thuan** — khong import Zod, khong biet gi ve MCP semantics
 * → test nhanh va dung lai duoc cho HTTP/SSE transport (task sau).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.1
 */

/** Phi ban bao loi chuan JSON-RPC 2.0. */
export const JSON_RPC_VERSION = '2.0' as const

/** Phien ban giao thuc MCP ma client nay noi. */
export const MCP_PROTOCOL_VERSION = '2024-11-05' as const

/** Request JSON-RPC co id (tra loi duoc). */
export interface JsonRpcRequest {
  jsonrpc: typeof JSON_RPC_VERSION
  id: number | string
  method: string
  params?: unknown
}

/** Response thanh cong. */
export interface JsonRpcSuccess {
  jsonrpc: typeof JSON_RPC_VERSION
  id: number | string
  result: unknown
}

/** Response loi. */
export interface JsonRpcError {
  jsonrpc: typeof JSON_RPC_VERSION
  id: number | string | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}

/** Response (thanh cong hoac loi). */
export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError

/**
 * Kiem tra 1 object co phai response loi khong.
 *
 * @param value - Gia tri can kiem tra.
 * @returns `true` neu la response loi.
 */
export function isJsonRpcError(value: JsonRpcResponse): value is JsonRpcError {
  return 'error' in value
}

/**
 * Tao request JSON-RPC.
 *
 * @param id - Id request (client tu sinh, duy nhat trong 1 phien ban).
 * @param method - Ten method (vd `tools/list`).
 * @param params - Tham so (tuong doi).
 * @returns Request da tao.
 */
export function createRequest(
  id: number | string,
  method: string,
  params?: unknown,
): JsonRpcRequest {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    method,
    ...(params !== undefined ? { params } : {}),
  }
}

/**
 * Tao response thanh cong.
 *
 * @param id - Id request tuong ung.
 * @param result - Ket qua.
 * @returns Response da tao.
 */
export function createResult(id: number | string, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSON_RPC_VERSION, id, result }
}

/**
 * Tao response loi.
 *
 * @param id - Id request tuong ung (`null` neu khong xac dinh).
 * @param code - Ma loi JSON-RPC.
 * @param message - Thong bao loi.
 * @param data - Du lieu them (tuong doi).
 * @returns Response da tao.
 */
export function createError(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  }
}

/**
 * Encode 1 message thanh 1 dong JSON (newline-delimited).
 *
 * @param message - Message can encode.
 * @returns Chuoi JSON + `\n`.
 */
export function encodeMessage(message: JsonRpcRequest | JsonRpcResponse): string {
  return `${JSON.stringify(message)}\n`
}

/**
 * Parse buffer thanh cac message JSON-RPC.
 *
 * - Tach theo `\n` → bo dong rong.
 * - Dong JSON hong → **bo qua** (khong crash) — server MCP co the in log
 *   rac vao stdout → phai phong bien.
 * - Message khong phai object → bo qua.
 *
 * @param buffer - Buffer chua text (thuong la phan dem cua stdout).
 * @returns Mang message da parse.
 */
export function parseMessages(buffer: string): JsonRpcResponse[] {
  const messages: JsonRpcResponse[] = []

  for (const rawLine of buffer.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      // Dong khong phai JSON → bo qua (khong phai JSON-RPC message).
      continue
    }

    if (typeof parsed !== 'object' || parsed === null) continue
    const record = parsed as Record<string, unknown>
    // Chi nhan response (co `id` va `result`/`error`).
    if (!('id' in record)) continue
    if (!('result' in record) && !('error' in record)) continue

    messages.push(parsed as JsonRpcResponse)
  }

  return messages
}
