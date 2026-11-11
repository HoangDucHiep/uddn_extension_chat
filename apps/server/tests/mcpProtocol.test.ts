import { describe, expect, it } from 'vitest'
import {
  createError,
  createRequest,
  createResult,
  encodeMessage,
  isJsonRpcError,
  JSON_RPC_VERSION,
  MCP_PROTOCOL_VERSION,
  parseMessages,
} from '../src/tools/mcp/protocol.js'

/**
 * Unit test cho framing JSON-RPC 2.0 cua MCP (FR-TOOLS-01 — T-M2-08).
 *
 * AC goc:
 * - "`mcp__<server>__<tool>` namespace tool MCP".
 * - "MCP client (stdio transport)".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27.1
 */

describe('protocol — constants', () => {
  it('dung phien ban JSON-RPC 2.0', () => {
    expect(JSON_RPC_VERSION).toBe('2.0')
  })

  it('dung phien ban giao thuc MCP 2024-11-05', () => {
    expect(MCP_PROTOCOL_VERSION).toBe('2024-11-05')
  })
})

describe('protocol — createRequest', () => {
  it('tao request co id + method', () => {
    expect(createRequest(1, 'tools/list')).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
  })

  it('them params khi duoc truyen', () => {
    const request = createRequest('abc', 'tools/call', { name: 'echo' })
    expect(request.params).toEqual({ name: 'echo' })
  })

  it('khong them params khi undefined', () => {
    const request = createRequest(2, 'ping')
    expect('params' in request).toBe(false)
  })
})

describe('protocol — createResult / createError', () => {
  it('tao result thanh cong', () => {
    expect(createResult(1, { tools: [] })).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] },
    })
  })

  it('tao error co ma + message', () => {
    const error = createError(3, -32601, 'Method not found')
    expect(error.error.code).toBe(-32601)
    expect(error.error.message).toBe('Method not found')
    expect(isJsonRpcError(error)).toBe(true)
  })

  it('them data vao error khi duoc truyen', () => {
    const error = createError(null, -32000, 'Loi', { hint: 'x' })
    expect(error.id).toBeNull()
    expect(error.error.data).toEqual({ hint: 'x' })
  })

  it('result khong phai error', () => {
    expect(isJsonRpcError(createResult(1, {}))).toBe(false)
  })
})

describe('protocol — encodeMessage', () => {
  it('ket thuc bang newline (newline-delimited JSON)', () => {
    const encoded = encodeMessage(createRequest(1, 'tools/list'))
    expect(encoded.endsWith('\n')).toBe(true)
    expect(JSON.parse(encoded)).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
  })
})

describe('protocol — parseMessages', () => {
  it('parse 1 message tu 1 dong', () => {
    const messages = parseMessages('{"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n')
    expect(messages).toHaveLength(1)
    expect(messages[0]?.id).toBe(1)
  })

  it('parse nhieu message trong 1 buffer', () => {
    const buffer =
      '{"jsonrpc":"2.0","id":1,"result":{}}\n{"jsonrpc":"2.0","id":2,"result":{}}\n'
    expect(parseMessages(buffer)).toHaveLength(2)
  })

  it('bo qua dong rong', () => {
    expect(parseMessages('\n\n   \n')).toHaveLength(0)
  })

  it('bo qua dong khong phai JSON (MCP server in log rac)', () => {
    const buffer = 'Server starting...\n{"jsonrpc":"2.0","id":1,"result":{}}\n'
    const messages = parseMessages(buffer)
    expect(messages).toHaveLength(1)
  })

  it('bo qua message khong phai object', () => {
    expect(parseMessages('123\n"abc"\n')).toHaveLength(0)
  })

  it('bo qua message khong co id hoac result/error', () => {
    const buffer =
      '{"jsonrpc":"2.0","method":"tools/list"}\n{"jsonrpc":"2.0","id":1}\n'
    expect(parseMessages(buffer)).toHaveLength(0)
  })

  it('parse response loi', () => {
    const buffer = '{"jsonrpc":"2.0","id":1,"error":{"code":-1,"message":"x"}}\n'
    const messages = parseMessages(buffer)
    expect(messages).toHaveLength(1)
    const first = messages[0]
    expect(first !== undefined && isJsonRpcError(first)).toBe(true)
  })
})
