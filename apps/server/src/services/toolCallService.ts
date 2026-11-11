/**
 * Service luu tool call vao Postgres (FR-TOOLS-06 — T-M2-07).
 *
 * Bang `tool_calls` da co san tu M0 (schema §5.2) → **khong migration**.
 * Dung 2 muc dich:
 *  1. Hien thi lai trong lich su chat (load conversation → join `tool_calls`).
 *  2. Danh cho eval (FR-TOOLS-06) — model nao goi tool gi, ket qua ra sao.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.4
 */

import { eq } from 'drizzle-orm'
import type { Database } from '../db/index.js'
import { toolCalls, type ToolCallRow } from '../db/schema.js'

/** 1 tool call can ghi (duoc chatService chuan hoa). */
export interface ToolCallRecordInput {
  /** Id tool call (uuid) — khop voi SSE `tool_call.id`. */
  id: string
  /** Ten tool da goi. */
  name: string
  /** Tham so model truyen. */
  args: unknown
  /** Ket qua tool (string). */
  output: string
  /** Trang thai: `ok` · `error` · `denied`. */
  status: string
  /** Tool co can user duyet khong. */
  approvalRequired: boolean
  /** User da duyet hay chua. */
  approvedByUser: boolean
  /** Thoi gian thuc thi (ms). */
  durationMs: number
}

/**
 * Ghi danh sach tool call vao bang `tool_calls`.
 *
 * Khong nem loi ra ngoai — tool call la **thong tin phu**, khong phai
 * nguon su that cua luot chat. Luot chat van luu binh thuong.
 *
 * @param db - Database client.
 * @param messageId - Id message assistant chua tool call.
 * @param records - Danh sach tool call.
 */
export async function persistToolCalls(
  db: Database,
  messageId: string,
  records: readonly ToolCallRecordInput[],
): Promise<void> {
  if (records.length === 0) return

  try {
    await db.insert(toolCalls).values(
      records.map((record) => ({
        id: record.id,
        messageId,
        name: record.name,
        args: (record.args ?? {}) as Record<string, unknown>,
        output: record.output,
        status: record.status,
        approvalRequired: record.approvalRequired,
        approvedByUser: record.approvedByUser,
        startedAt: new Date(),
        finishedAt: new Date(),
      })),
    )
  } catch {
    // Khong ghi duoc tool call → chi mat hien thi lich su, khong hong chat.
  }
}

/**
 * Doc tool call cua 1 message.
 *
 * @param db - Database client.
 * @param messageId - Id message.
 * @returns Danh sach tool call (moi nhat truoc).
 */
export async function loadToolCalls(db: Database, messageId: string): Promise<ToolCallRow[]> {
  return db.select().from(toolCalls).where(eq(toolCalls.messageId, messageId))
}

/**
 * Duyet 1 tool call (FR-TOOLS-04 — T-M2-09).
 *
 * @param db - Database client.
 * @param callId - Id tool call.
 * @param approved - `true` = duyet, `false` = tu choi.
 * @returns Row sau khi cap nhat, `undefined` neu khong tim thay.
 */
export async function setToolCallApproval(
  db: Database,
  callId: string,
  approved: boolean,
): Promise<ToolCallRow | undefined> {
  try {
    const rows = await db
      .update(toolCalls)
      .set({ approvedByUser: approved })
      .where(eq(toolCalls.id, callId))
      .returning()
    return rows[0]
  } catch {
    return undefined
  }
}
