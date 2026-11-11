#!/usr/bin/env node
/**
 * MCP server mau (stdio transport) — dung de **demo tay** va cho unit test.
 *
 * Noi dung dung MCP protocol toi thieu:
 * - `initialize` → tra `protocolVersion` + `capabilities`.
 * - `notifications/initialized` → notification (khong tra loi).
 * - `tools/list` → tra 2 tool: `echo` + `add`.
 * - `tools/call` → chay tool, tra `content` (array block text).
 *
 * Chay tay:
 * ```bash
 * node apps/server/scripts/sample-mcp-server.mjs
 * ```
 * → sau do trong Sidekick Settings them MCP server:
 * - Ten: `sample`
 * - Lenh: `node`
 * - Tham so: `<duong-dan-tuyet-voi>/apps/server/scripts/sample-mcp-server.mjs`
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27
 */

import { createInterface } from 'node:readline'

const PROTOCOL_VERSION = '2024-11-05'

/** Danh sach tool cua MCP server mau. */
const TOOLS = [
  {
    name: 'echo',
    description: 'Tra ve lai chuoi duoc truyen vao (dung de kiem tra MCP client).',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Chuoi can tra lai' },
      },
      required: ['text'],
    },
  },
  {
    name: 'add',
    description: 'Cong 2 so.',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number', description: 'So thu nhat' },
        b: { type: 'number', description: 'So thu hai' },
      },
      required: ['a', 'b'],
    },
  },
]

/**
 * Tra ve ket qua chay tool.
 *
 * @param name - Ten tool.
 * @param args - Tham so.
 * @returns Chuoi ket qua.
 */
function runTool(name, args) {
  if (name === 'echo') {
    const text = typeof args?.text === 'string' ? args.text : ''
    return `echo: ${text}`
  }

  if (name === 'add') {
    const a = typeof args?.a === 'number' ? args.a : Number(args?.a)
    const b = typeof args?.b === 'number' ? args.b : Number(args?.b)
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new Error('add: tham so khong phai so')
    }
    return `add: ${a + b}`
  }

  throw new Error(`Khong biet tool "${name}"`)
}

const rl = createInterface({ input: process.stdin })

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (trimmed.length === 0) return

  let request
  try {
    request = JSON.parse(trimmed)
  } catch {
    // Dong khong phai JSON → bo qua (giong MCP client).
    return
  }

  if (typeof request !== 'object' || request === null) return
  const id = request.id
  const method = request.method

  // Notification (khong co id) → khong tra loi.
  if (id === undefined || id === null) return

  /** Tra ve response thanh cong. */
  const ok = (result) => {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`)
  }

  /** Tra ve response loi. */
  const fail = (code, message) => {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`,
    )
  }

  if (method === 'initialize') {
    ok({
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'sample-mcp-server', version: '0.1.0' },
    })
    return
  }

  if (method === 'tools/list') {
    ok({ tools: TOOLS })
    return
  }

  if (method === 'tools/call') {
    const params = request.params
    const name = typeof params?.name === 'string' ? params.name : ''
    try {
      const output = runTool(name, params?.arguments)
      ok({ content: [{ type: 'text', text: output }], isError: false })
    } catch (error) {
      ok({
        content: [
          { type: 'text', text: error instanceof Error ? error.message : String(error) },
        ],
        isError: true,
      })
    }
    return
  }

  fail(-32601, `Method khong ho tro: ${String(method)}`)
})

// Dong stdin → ket thuc process (client da disconnect).
rl.on('close', () => {
  process.exit(0)
})
