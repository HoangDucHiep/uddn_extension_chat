/**
 * Zod schema + contract cho tool (FR-TOOLS-01/02/04/06 — T-M2-07).
 *
 * Mot **tool** la mot ham co ten + mo ta + JSON Schema tham so, duoc
 * model goi trong luc chat (function calling). Server thuc thi tool roi
 * tra ket qua ve lai cho model.
 *
 * Contract nay nam o `packages/shared` de server (thuc thi), extension
 * (hien thi) va eval harness (do) dung **cung mot nguon su that**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26
 */

import { z } from 'zod'

/**
 * Trang thai cua 1 tool call.
 *
 * `pending` · `running` → chua xong · `ok` · `error` · `denied` → da xong.
 *
 * Dung chung cho server (ghi DB) · extension (hien thi) · contract.
 */
export { TOOL_CALL_STATUSES, type ToolCallStatus } from '../constants.js'

/**
 * JSON Schema cua tham so cua 1 tool.
 *
 * Chi cho phep shape **object** — provider (OpenAI-compatible) chi ho tro
 * function voi tham so object nen han loai o day.
 */
export const toolParametersSchema = z.object({
  type: z.literal('object'),
  /** Thuoc tinh tham so — moi value la 1 JSON Schema con. */
  properties: z.record(z.string(), z.unknown()),
  /** Danh sach ten tham so bat buoc. */
  required: z.array(z.string()).optional(),
})
export type ToolParameters = z.infer<typeof toolParametersSchema>

/**
 * Mo ta 1 tool — dung de gui cho provider va hien thi trong UI.
 */
export const toolDefinitionSchema = z.object({
  /** Ten tool — unique trong 1 registry, model goi bang ten nay. */
  name: z.string().min(1).max(120),
  /** Mo ta cho model biet tool lam gi (ngon tu tu nhien). */
  description: z.string().max(2000),
  /** JSON Schema cua tham so. */
  parameters: toolParametersSchema,
})
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>

/**
 * Ket qua thuc thi 1 tool.
 *
 * `ok: false` **khong** phai loi he thong — day la thong tin de model biet
 * tool that bai va tu quyet dinh buoc tiep theo (van tra loi duoc).
 */
export const toolResultSchema = z.object({
  /** Tool co chay thanh cong khong. */
  ok: z.boolean(),
  /** Ket qua (hoac thong bao loi) duoc gui lai cho model. */
  output: z.string(),
  /** Chi co khi `ok === false` — mo ta ngan loi. */
  error: z.string().optional(),
})
export type ToolResult = z.infer<typeof toolResultSchema>

/**
 * Co can user duyet tool nay khong (FR-TOOLS-04 — T-M2-09).
 *
 * Tool doc-only (vi du `calculator`) → `false`. Tool ghi du lieu →
 * `true` → UI hien thi badge "Can duyet" + nut Duyet / Tu choi.
 */
export const toolRequiresApprovalSchema = z.boolean()

/**
 * 1 tool call da ghi trong DB (bang `tool_calls`).
 *
 * Dung cho: history chat (load lai tool block), audit log (FR-TOOLS-06).
 */
export const toolCallRecordSchema = z.object({
  /** Id tool call (uuid) — khop voi `tool_calls.id` va SSE `tool_call.id`. */
  id: z.string().min(1),
  /** Ten tool da goi. */
  name: z.string().min(1),
  /** Tham so model truyen — luu dang string de hien thi an toan. */
  args: z.unknown(),
  /** Ket qua tool (string) — `undefined` neu chua xong. */
  output: z.string().optional(),
  /** Trang thai: `pending` · `running` · `ok` · `error` · `denied`. */
  status: z.string().min(1),
  /** Tool co can user duyet khong. */
  approvalRequired: z.boolean(),
  /** User da duyet hay chua. */
  approvedByUser: z.boolean(),
  /** Thoi gian thuc thi (ms). */
  durationMs: z.number().int().nonnegative().optional(),
})
export type ToolCallRecord = z.infer<typeof toolCallRecordSchema>

/**
 * Response cua `GET /api/tools` — danh sach tool server dang co.
 */
export const toolListResponseSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      description: z.string(),
      requiresApproval: z.boolean(),
    }),
  ),
})
export type ToolListResponse = z.infer<typeof toolListResponseSchema>

/**
 * Response cua `POST /api/tools/:callId/approve` va `/deny`.
 */
export const toolApprovalResponseSchema = z.object({
  /** Id tool call vua duet / tu choi. */
  id: z.string().min(1),
  /** Trang thai duyet sau khi cap nhat. */
  approvedByUser: z.boolean(),
})
export type ToolApprovalResponse = z.infer<typeof toolApprovalResponseSchema>
