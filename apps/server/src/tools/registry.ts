/**
 * Registry cua cac tool server (FR-TOOLS-01 — T-M2-07).
 *
 * Registry **in-memory** (khong can bang DB) → don gian, khong migration.
 * T-M2-08 se bo sung tool tu MCP server vao cung registry nay.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.2
 */

import type { ToolDefinition } from '@sidekick/shared'
import { calculatorTool } from './builtin/calculator.js'
import type { Tool } from './types.js'

/**
 * Registry tool.
 *
 * Tool duoc dinh danh bang **ten** → map de tra cu trong O(1).
 */
export class ToolRegistry {
  /** Tool theo ten. */
  private readonly tools = new Map<string, Tool>()

  /**
   * Dang ky 1 tool.
   *
   * Dang ky trung ten → **ghi de** (cho phep MCP server thay the tool
   * cung ten cua tool built-in neu user muon).
   *
   * @param tool - Tool can dang ky.
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Lay tool theo ten.
   *
   * @param name - Ten tool.
   * @returns Tool neu ton tai, `undefined` neu khong.
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Go 1 tool khoi registry.
   *
   * Dung khi MCP server bi xoa/tat → tool cua server phai bien mat khoi
   * danh sach gui cho provider (khong de model goi tool da chet).
   *
   * @param name - Ten tool can go.
   * @returns `true` neu da go 1 tool.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name)
  }

  /**
   * Go moi tool co tien to cho truoc.
   *
   * Dung cho namespace MCP (`mcp__<server>__`) → go tool cua 1 server ma
   * khong go nham tool built-in.
   *
   * @param prefix - Tien to ten tool.
   * @returns So tool da go.
   */
  unregisterByPrefix(prefix: string): number {
    let removed = 0
    for (const name of [...this.tools.keys()]) {
      if (name.startsWith(prefix)) {
        this.tools.delete(name)
        removed += 1
      }
    }
    return removed
  }

  /** Danh sach tool dang co (theo thu tu dang ky). */
  list(): Tool[] {
    return [...this.tools.values()]
  }

  /** Danh sach tool dang bat — dung de gui cho provider. */
  listEnabled(): Tool[] {
    return this.list()
  }

  /**
   * Tool co can user duyet khong (FR-TOOLS-04 — T-M2-09).
   *
   * @param name - Ten tool.
   * @returns `true` neu tool ton tai va can duyet, `false` neu khong.
   */
  requiresApproval(name: string): boolean {
    return this.tools.get(name)?.requiresApproval ?? false
  }

  /** Ly do canh bao cua tool (tieng Viet) — `undefined` neu khong can duyet. */
  approvalReason(name: string): string | undefined {
    return this.tools.get(name)?.approvalReason
  }

  /**
   * Chuyen danh sach tool thanh `ToolDefinition` de gui cho provider.
   *
   * @param names - Ten cac tool duoc chon (theo thu tu uu tien).
   * @returns Danh sach definition hop le.
   */
  toDefinitions(names: readonly string[]): ToolDefinition[] {
    const definitions: ToolDefinition[] = []
    for (const name of names) {
      const tool = this.tools.get(name)
      if (tool === undefined) continue
      definitions.push({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })
    }
    return definitions
  }
}

/**
 * Tao registry mac dinh — dang ky cac tool built-in.
 *
 * T-M2-07: chi co `calculator`. T-M2-08 se them tool tu MCP server.
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry()
  registry.register(calculatorTool)
  return registry
}

/** Ten tool built-in duoc bat san. */
export const BUILTIN_TOOL_NAMES = ['calculator'] as const
