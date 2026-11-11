import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TOOL_NAMES,
  createDefaultToolRegistry,
  ToolRegistry,
} from '../src/tools/registry.js'
import { calculatorTool } from '../src/tools/builtin/calculator.js'
import type { Tool } from '../src/tools/types.js'

/**
 * Unit test cho `ToolRegistry` (FR-TOOLS-01 — T-M2-07).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.2
 */

/** Tao tool gia lap de test registry. */
function makeTool(name: string, requiresApproval = false): Tool {
  return {
    name,
    description: `Mo ta cua ${name}`,
    parameters: { type: 'object', properties: {} },
    requiresApproval,
    ...(requiresApproval ? { approvalReason: `Can duyet ${name}` } : {}),
    async execute() {
      return { ok: true, output: 'ok' }
    },
  }
}

describe('ToolRegistry', () => {
  it('register roi get theo ten', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    expect(registry.get('alpha')?.name).toBe('alpha')
  })

  it('get tool khong ton tai → undefined', () => {
    const registry = new ToolRegistry()
    expect(registry.get('khong-co')).toBeUndefined()
  })

  it('register trung ten → ghi de (cho phep MCP override built-in)', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    registry.register(makeTool('alpha'))
    expect(registry.list()).toHaveLength(1)
  })

  it('listEnabled tra ve tat ca tool dang co', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    registry.register(makeTool('beta'))
    expect(registry.listEnabled().map((tool) => tool.name)).toEqual(['alpha', 'beta'])
  })

  it('requiresApproval tra false cho tool doc-only', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    expect(registry.requiresApproval('alpha')).toBe(false)
  })

  it('requiresApproval tra true cho tool can duyet', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('danger', true))
    expect(registry.requiresApproval('danger')).toBe(true)
  })

  it('requiresApproval tool khong ton tai → false', () => {
    const registry = new ToolRegistry()
    expect(registry.requiresApproval('khong-co')).toBe(false)
  })

  it('approvalReason tra ly do canh bao', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('danger', true))
    expect(registry.approvalReason('danger')).toBe('Can duyet danger')
  })

  it('approvalReason tool doc-only → undefined', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    expect(registry.approvalReason('alpha')).toBeUndefined()
  })

  it('toDefinitions tra dung shape provider can', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    const definitions = registry.toDefinitions(['alpha'])
    expect(definitions).toHaveLength(1)
    expect(definitions[0]?.name).toBe('alpha')
    expect(definitions[0]?.parameters.type).toBe('object')
  })

  it('toDefinitions bo qua tool khong ton tai', () => {
    const registry = new ToolRegistry()
    registry.register(makeTool('alpha'))
    expect(registry.toDefinitions(['alpha', 'khong-co'])).toHaveLength(1)
  })
})

describe('createDefaultToolRegistry', () => {
  it('dang ky san tool `calculator`', () => {
    const registry = createDefaultToolRegistry()
    expect(registry.get('calculator')).toBeDefined()
    expect(registry.get('calculator')).toBe(calculatorTool)
  })

  it('BUILTIN_TOOL_NAMES khop voi registry mac dinh', () => {
    const registry = createDefaultToolRegistry()
    expect(registry.listEnabled().map((tool) => tool.name)).toEqual([
      ...BUILTIN_TOOL_NAMES,
    ])
  })
})
