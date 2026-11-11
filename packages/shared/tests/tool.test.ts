import { describe, expect, it } from 'vitest'
import {
  toolCallRecordSchema,
  toolDefinitionSchema,
  toolListResponseSchema,
  toolParametersSchema,
  toolResultSchema,
} from '../src/schemas/tool.js'
import { TOOL_LIMITS } from '../src/constants.js'

describe('tool schema', () => {
  it('parse tool definition hop le', () => {
    const parsed = toolDefinitionSchema.safeParse({
      name: 'calculator',
      description: 'Tinh bieu thuc so hoc',
      parameters: {
        type: 'object',
        properties: { expression: { type: 'string' } },
        required: ['expression'],
      },
    })
    expect(parsed.success).toBe(true)
  })

  it('tool definition thieu parameters bi tu choi', () => {
    const parsed = toolDefinitionSchema.safeParse({
      name: 'calculator',
      description: 'Tinh',
    })
    expect(parsed.success).toBe(false)
  })

  it('parameters chi nhan type object', () => {
    expect(
      toolParametersSchema.safeParse({ type: 'string', properties: {} }).success,
    ).toBe(false)
  })

  it('parameters cho phep bo required', () => {
    const parsed = toolParametersSchema.safeParse({ type: 'object', properties: {} })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.required).toBeUndefined()
    }
  })

  it('parse tool result thanh cong', () => {
    const parsed = toolResultSchema.safeParse({ ok: true, output: '4' })
    expect(parsed.success).toBe(true)
  })

  it('parse tool result that bai', () => {
    const parsed = toolResultSchema.safeParse({ ok: false, output: 'Chia 0', error: 'DIV_BY_ZERO' })
    expect(parsed.success).toBe(true)
  })

  it('tool result thieu output bi tu choi', () => {
    expect(toolResultSchema.safeParse({ ok: true }).success).toBe(false)
  })

  it('parse tool call record', () => {
    const parsed = toolCallRecordSchema.safeParse({
      id: 'tc-1',
      name: 'calculator',
      args: { expression: '2+2' },
      output: '4',
      status: 'ok',
      approvalRequired: false,
      approvedByUser: false,
      durationMs: 3,
    })
    expect(parsed.success).toBe(true)
  })

  it('tool call record thieu approvalRequired bi tu choi', () => {
    const parsed = toolCallRecordSchema.safeParse({
      id: 'tc-1',
      name: 'calculator',
      args: {},
      status: 'ok',
      approvedByUser: false,
    })
    expect(parsed.success).toBe(false)
  })

  it('parse tool list response', () => {
    const parsed = toolListResponseSchema.safeParse({
      items: [{ name: 'calculator', description: 'Tinh', requiresApproval: false }],
    })
    expect(parsed.success).toBe(true)
  })
})

describe('TOOL_LIMITS', () => {
  it('gioi han 5 vong agent loop (FR-TOOLS-02)', () => {
    expect(TOOL_LIMITS.MAX_TOOL_ROUNDS).toBe(5)
  })

  it('gioi han output tool va so tool gui cho provider', () => {
    expect(TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS).toBeGreaterThan(0)
    expect(TOOL_LIMITS.MAX_TOOLS_PER_REQUEST).toBeGreaterThan(0)
  })
})
