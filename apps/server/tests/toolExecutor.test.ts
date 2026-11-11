import { describe, expect, it } from 'vitest'
import { TOOL_LIMITS } from '@sidekick/shared'
import { executeTool, truncateOutput } from '../src/tools/executor.js'
import { ToolRegistry } from '../src/tools/registry.js'
import type { Tool } from '../src/tools/types.js'

/**
 * Unit test cho bo thuc thi tool (FR-TOOLS-02 — T-M2-07).
 *
 * AC goc:
 * - "Tool nem loi → `ok: false` (khong lam hong luot chat)".
 * - "Output qua dai → cat bo".
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.3
 */

const CTX = { requestId: 'req-1' }

/** Tao registry voi 1 tool gia lap. */
function registryWith(tool: Tool): ToolRegistry {
  const registry = new ToolRegistry()
  registry.register(tool)
  return registry
}

describe('executeTool', () => {
  it('tool chay thanh cong → ok:true + output', async () => {
    const registry = registryWith({
      name: 'echo',
      description: 'Echo',
      parameters: { type: 'object', properties: {} },
      requiresApproval: false,
      async execute(args) {
        return { ok: true, output: JSON.stringify(args) }
      },
    })

    const outcome = await executeTool(registry, 'echo', { a: 1 }, CTX)
    expect(outcome.ok).toBe(true)
    expect(outcome.output).toBe('{"a":1}')
    expect(outcome.name).toBe('echo')
    expect(outcome.approvalRequired).toBe(false)
  })

  it('tool nem loi → ok:false, khong nem loi ra ngoai', async () => {
    const registry = registryWith({
      name: 'boom',
      description: 'Boom',
      parameters: { type: 'object', properties: {} },
      requiresApproval: false,
      async execute() {
        throw new Error('loi khong mong doi')
      },
    })

    const outcome = await executeTool(registry, 'boom', {}, CTX)
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toBe('TOOL_THREW')
  })

  it('tool tra ok:false → giu nguyen error', async () => {
    const registry = registryWith({
      name: 'fail',
      description: 'Fail',
      parameters: { type: 'object', properties: {} },
      requiresApproval: false,
      async execute() {
        return { ok: false, output: 'Khong duoc', error: 'NO_PERMISSION' }
      },
    })

    const outcome = await executeTool(registry, 'fail', {}, CTX)
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toBe('NO_PERMISSION')
    expect(outcome.output).toBe('Khong duoc')
  })

  it('tool khong ton tai → ok:false + TOOL_NOT_FOUND', async () => {
    const registry = new ToolRegistry()
    const outcome = await executeTool(registry, 'khong-co', {}, CTX)
    expect(outcome.ok).toBe(false)
    expect(outcome.error).toBe('TOOL_NOT_FOUND')
  })

  it('tool can duyet → approvalRequired=true trong outcome', async () => {
    const registry = registryWith({
      name: 'danger',
      description: 'Danger',
      parameters: { type: 'object', properties: {} },
      requiresApproval: true,
      approvalReason: 'Can duyet',
      async execute() {
        return { ok: true, output: 'chua chay' }
      },
    })

    const outcome = await executeTool(registry, 'danger', {}, CTX)
    expect(outcome.approvalRequired).toBe(true)
  })

  it('output qua dai → cat bo theo TOOL_LIMITS', async () => {
    const registry = registryWith({
      name: 'long',
      description: 'Long',
      parameters: { type: 'object', properties: {} },
      requiresApproval: false,
      async execute() {
        return { ok: true, output: 'x'.repeat(TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS + 500) }
      },
    })

    const outcome = await executeTool(registry, 'long', {}, CTX)
    expect(outcome.output.length).toBeLessThan(TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS + 100)
    expect(outcome.output).toContain('da cat')
  })
})

describe('truncateOutput', () => {
  it('output ngan → giu nguyen', () => {
    expect(truncateOutput('abc')).toBe('abc')
  })

  it('output dai → cat + them ghi chu', () => {
    const result = truncateOutput('x'.repeat(TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS + 10))
    expect(result).toContain('da cat 10 ky tu')
  })
})
