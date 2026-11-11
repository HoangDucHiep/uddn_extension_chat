/**
 * Bo thuc thi tool (FR-TOOLS-02 — T-M2-07).
 *
 * Nguyen tac: **loi tool khong lam hong ca luot chat**. Tool that bai →
 * tra `ToolResult { ok: false }` → model nhan ket qua do de tu quyet
 * dinh buoc tiep theo → van co cau tra loi cho user.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.3
 */

import { TOOL_LIMITS, type ToolResult } from '@sidekick/shared'
import type { ToolRegistry } from './registry.js'
import type { ToolContext } from './types.js'

/** Ket qua thuc thi tool + thoi gian da ton. */
export interface ToolExecutionOutcome extends ToolResult {
  /** Ten tool da goi. */
  name: string
  /** Thoi gian thuc thi (ms). */
  durationMs: number
  /** Tool co can user duyet khong (FR-TOOLS-04). */
  approvalRequired: boolean
}

/**
 * Thuc thi 1 tool theo ten.
 *
 * - Tool khong ton tai → `ok: false` (model se thu tool khac).
 * - Tool nem loi → `ok: false` (khong nem ra ngoài).
 * - Output qua dai → cat bo theo `TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS`.
 *
 * @param registry - Registry chua tool.
 * @param name - Ten tool model goi.
 * @param args - Tham so model truyen.
 * @param ctx - Context thuc thi.
 * @returns Ket qua + thoi gian + co can duyet khong.
 */
export async function executeTool(
  registry: ToolRegistry,
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<ToolExecutionOutcome> {
  const startedAt = Date.now()
  const tool = registry.get(name)

  if (tool === undefined) {
    return {
      name,
      ok: false,
      output: `Khong tim thay tool "${name}".`,
      error: 'TOOL_NOT_FOUND',
      durationMs: Date.now() - startedAt,
      approvalRequired: false,
    }
  }

  try {
    const result = await tool.execute(args, ctx)
    return {
      name,
      ok: result.ok,
      output: truncateOutput(result.output),
      ...(result.error !== undefined ? { error: result.error } : {}),
      durationMs: Date.now() - startedAt,
      approvalRequired: tool.requiresApproval,
    }
  } catch {
    // Tool nem loi → bat lai de luot chat khong hong.
    return {
      name,
      ok: false,
      output: 'Tool gap loi khong mong doi.',
      error: 'TOOL_THREW',
      durationMs: Date.now() - startedAt,
      approvalRequired: tool.requiresApproval,
    }
  }
}

/**
 * Cat output tool neu qua dai (tran context window).
 *
 * @param output - Output goc.
 * @returns Output da cat.
 */
export function truncateOutput(output: string): string {
  if (output.length <= TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS) {
    return output
  }
  const kept = output.slice(0, TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS)
  return `${kept}\n... (da cat ${output.length - TOOL_LIMITS.MAX_TOOL_OUTPUT_CHARS} ky tu)`
}
