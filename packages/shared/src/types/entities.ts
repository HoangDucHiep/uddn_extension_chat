/**
 * Type dung chung cho conversation / message / citation / tool call.
 * Moi thay doi o day deu phai reflect vao docs/SYSTEM_DESIGN.md §5.
 */

import { z } from 'zod'
import { PROVIDER_IDS } from '../constants.js'
import { conversationCitationSchema } from '../schemas/conversation.js'

/** Vai tro cua mot message trong hoi thoai. */
export const MESSAGE_ROLES = ['user', 'assistant', 'system', 'tool'] as const
export type MessageRole = (typeof MESSAGE_ROLES)[number]

export const messageRoleSchema = z.enum(MESSAGE_ROLES)

/** Conversation. */
export const conversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
  meta: z.record(z.string(), z.unknown()),
})
export type Conversation = z.infer<typeof conversationSchema>

/** Message trong hoi thoai. */
export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: messageRoleSchema,
  content: z.string(),
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  /**
   * Nguon trich dan cua message (FR-CONTEXT-10 — T-M1-09).
   *
   * Chi co khi message da duoc luu vao DB → dung khoi phuc lich su.
   */
  citations: z.array(conversationCitationSchema).optional(),
  /** Provider/model da sinh message (DP-6). */
  provider: z.string().optional(),
  model: z.string().optional(),
  /** Token da dung (DP-6). */
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  /**
   * Id cua turn chua message nay (T-M1-10).
   *
   * User message + cac bien the assistant cua cung 1 luot hoi–dap chia
   * chung `turnId`.
   */
  turnId: z.string().optional(),
  /** Chi so bien the assistant trong turn (0-based). */
  variantIndex: z.number().int().nonnegative().optional(),
  /** Message co nam tren duong di active cua conversation khong. */
  active: z.boolean().optional(),
  /** Id cua turn cha (khi sua & gui lai → tao branch). */
  parentTurnId: z.string().optional(),
  /** Assistant bi stop giua chung → co nut "Tiep tuc". */
  aborted: z.boolean().optional(),
})
export type Message = z.infer<typeof messageSchema>

/** Trich dan (nguon cua cau tra loi). */
export const citationSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  index: z.number().int().nonnegative(),
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  tabId: z.number().int().optional(),
  score: z.number().optional(),
})
export type Citation = z.infer<typeof citationSchema>

/** Trang thai mot tool call. */
export const TOOL_CALL_STATUSES = ['pending', 'running', 'ok', 'error', 'denied'] as const
export type ToolCallStatus = (typeof TOOL_CALL_STATUSES)[number]

export const toolCallSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  name: z.string(),
  args: z.unknown(),
  output: z.string().nullable(),
  status: z.enum(TOOL_CALL_STATUSES),
  approvalRequired: z.boolean(),
  approvedByUser: z.boolean(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
})
export type ToolCall = z.infer<typeof toolCallSchema>

/**
 * Provider info (public metadata, khong bao gio lo key).
 *
 * `keySource` = nguon key dang dung cho provider do:
 *  - `K1` — team key trong `.env` cua BFF
 *  - `K2` — BYOK cua user, ma hoa trong Postgres
 *  - `K3` — BYOK gui thang tu client (fallback khi BFF down)
 *  - `none` — provider khong can key (mock, ollama local)
 */
export const providerInfoSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  name: z.string(),
  models: z.array(z.string()),
  keySource: z.enum(['K1', 'K2', 'K3', 'none']),
  requiresKey: z.boolean(),
  available: z.boolean(),
  /**
   * Ghi chu ngan cho UI (tieng Viet).
   *
   * Dung khi provider chua san dung duoc — vd "Ollama chua chay tai
   * localhost:11434" → onboarding hien thi huong dan thay vi loi chung chung.
   */
  note: z.string().max(200).optional(),
})
export type ProviderInfo = z.infer<typeof providerInfoSchema>

/** Ban ghi log co cau truc cua mot request chat. */
export const requestLogSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string(),
  conversationId: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  keySource: z.string(),
  promptText: z.string().nullable(),
  contextHash: z.string().nullable(),
  contextSnapshot: z.unknown().nullable(),
  responseText: z.string().nullable(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  ttftMs: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative(),
  toolCalls: z.unknown().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
})
export type RequestLog = z.infer<typeof requestLogSchema>
