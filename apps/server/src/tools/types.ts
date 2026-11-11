/**
 * Interface cua 1 tool (FR-TOOLS-01 — T-M2-07).
 *
 * Tool la mot ham co ten + mo ta + JSON Schema tham so, duoc model goi
 * trong luc chat (function calling). Server thuc thi tool roi gui ket qua
 * ve lai cho model trong vong tiep theo cua agent loop.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26
 */

import type { ToolDefinition, ToolResult } from '@sidekick/shared'

/** Context truyền vào khi thực thi tool. */
export interface ToolContext {
  /** Signal hủy (client đóng panel → huỷ luôn tool đang chạy). */
  signal?: AbortSignal | undefined
  /** Request-id để đối chiếu log. */
  requestId: string
}

/**
 * 1 tool trong registry.
 *
 * Registry la **in-memory** ở M2-07 (không cần bảng DB) → MCP sẽ bổ sung
 * nguồn tool từ `mcp_servers` ở T-M2-08.
 */
export interface Tool {
  /** Tên tool — unique trong 1 registry, model gọi bằng tên này. */
  name: string
  /** Mô tả cho model biết tool làm gì (ngôn tự tự nhiên). */
  description: string
  /** JSON Schema của tham số. */
  parameters: ToolDefinition['parameters']
  /**
   * Tool có cần user duyệt không (FR-TOOLS-04 — T-M2-09).
   *
   * Tool chỉ đọc (vd `calculator`) → `false`. Tool ghi dữ liệu → `true` →
   * server **không** chạy tool, UI hiện badge "Cần duyệt" + nút Duyệt.
   */
  requiresApproval: boolean
  /** Lý do cảnh báo khi cần duyệt (tiếng Việt) — hiển thị cho user. */
  approvalReason?: string | undefined
  /** Thực thi tool. Không được throw ra ngoài — lỗi trả về qua `ToolResult`. */
  execute(args: unknown, ctx: ToolContext): Promise<ToolResult>
}
