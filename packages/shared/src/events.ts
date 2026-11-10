/**
 * SSE event union cho luong chat.
 *
 * Wire format:
 *   event: token
 *   data: {"type":"token","delta":"Xin","index":0}
 *
 * Quy tac (docs/SYSTEM_DESIGN.md §4.3):
 *  1. `meta` luon la event dau tien.
 *  2. `token` mang `delta` (phan text tang them), khong gui ca message.
 *  3. `done` la event cuoi cung — client finalize bang no.
 *  4. Loi: gui `error` roi `done` voi `finishReason:'error'`.
 */

import { z } from 'zod'
import { BUDGET_PERIODS, BUDGET_STATES } from './budget.js'

/** Metadata mo dau stream. */
export const chatMetaEventSchema = z.object({
  type: z.literal('meta'),
  messageId: z.string().min(1),
  conversationId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  keySource: z.string().min(1),
  requestId: z.string().min(1),
  /**
   * Id cua turn chua message nay (T-M1-10).
   *
   * Client dung de gom bien the + dong bo path sau khi reload panel.
   */
  turnId: z.string().min(1).optional(),
})
export type ChatMetaEvent = z.infer<typeof chatMetaEventSchema>

/** Chunk text. */
export const chatTokenEventSchema = z.object({
  type: z.literal('token'),
  delta: z.string(),
  index: z.number().int().nonnegative(),
})
export type ChatTokenEvent = z.infer<typeof chatTokenEventSchema>

/** Nguon trich dan (web page / tab hien tai). */
export const chatCitationEventSchema = z.object({
  type: z.literal('citation'),
  index: z.number().int().nonnegative(),
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  tabId: z.number().int().optional(),
})
export type ChatCitationEvent = z.infer<typeof chatCitationEventSchema>

/** Yeu cau goi tool. */
export const chatToolCallEventSchema = z.object({
  type: z.literal('tool_call'),
  id: z.string().min(1),
  name: z.string().min(1),
  args: z.unknown(),
})
export type ChatToolCallEvent = z.infer<typeof chatToolCallEventSchema>

/** Ket qua tool. */
export const chatToolResultEventSchema = z.object({
  type: z.literal('tool_result'),
  id: z.string().min(1),
  ok: z.boolean(),
  output: z.string(),
  durationMs: z.number().nonnegative(),
})
export type ChatToolResultEvent = z.infer<typeof chatToolResultEventSchema>

/** Thong ke token + chi phi. */
export const chatUsageEventSchema = z.object({
  type: z.literal('usage'),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
})
export type ChatUsageEvent = z.infer<typeof chatUsageEventSchema>

/**
 * Thong bao server da chuyen sang provider du phong (FR-PROVIDER-04 — T-M2-02).
 *
 * Emit **giua** luong (sau `meta`, truoc token dau tien) khi provider chinh
 * loi tam thoi (429/5xx/network) → server thu provider tiep theo trong chuoi
 * fallback. Client dung event nay de bao nguoi dung "da chuyen sang X".
 */
export const chatProviderSwitchEventSchema = z.object({
  type: z.literal('provider_switch'),
  /** Provider bi loi (da thu khong thanh cong). */
  from: z.string().min(1),
  /** Provider dang duoc dung sau khi chuyen. */
  to: z.string().min(1),
  /** Ly do chuyen (error code cua provider truoc do). */
  reason: z.string().min(1),
  /** Model dang dung sau khi chuyen (model theo provider moi). */
  model: z.string().optional(),
})
export type ChatProviderSwitchEvent = z.infer<typeof chatProviderSwitchEventSchema>

/**
 * Trang thai budget cap (FR-PROVIDER-06 — T-M2-03b).
 *
 * Server tinh tong chi phi da dung trong ky (`daily` | `monthly`) tu
 * `request_logs.cost_usd` → client hien thi banner canh bao khi vuot
 * nguong, va biet chinh xac khi nao bi **chan**.
 */
export const chatBudgetEventSchema = z.object({
  type: z.literal('budget'),
  /** Trang thai: `disabled` · `ok` · `warning` · `exceeded`. */
  state: z.enum(BUDGET_STATES),
  /** Chi phi da dung trong ky (USD). */
  spentUsd: z.number().nonnegative(),
  /** Han muc (USD). */
  limitUsd: z.number().nonnegative(),
  /** Phan tram da dung (%) — 0 khi budget tat. */
  percentUsed: z.number().nonnegative(),
  /** Ky dang tinh. */
  period: z.enum(BUDGET_PERIODS),
})
export type ChatBudgetEvent = z.infer<typeof chatBudgetEventSchema>

/** Loi giua luong. */
export const chatErrorEventSchema = z.object({
  type: z.literal('error'),
  code: z.string().min(1),
  message: z.string(),
  /**
   * Loi co the thu lai khong.
   *
   * Server set tu provider chunk (`errorRetryable`) — **khong** hardcode
   * `true`, vi loi 401 (sai API key) thi retry vo ich.
   * FR-CHAT-14 / NFR-REL-02 — T-M1-19.
   */
  retryable: z.boolean(),
  /**
   * So giay user phai cho truoc khi thu lai (429).
   *
   * Provider gui header `Retry-After` → server chuyen sang day.
   * `undefined` → client dung gia tri mac dinh theo nhom loi.
   */
  retryAfterSeconds: z.number().int().nonnegative().optional(),
})
export type ChatErrorEvent = z.infer<typeof chatErrorEventSchema>

/** Ket thuc luong. */
export const chatDoneEventSchema = z.object({
  type: z.literal('done'),
  finishReason: z.enum(['stop', 'length', 'tool', 'aborted', 'error']),
  messageId: z.string().min(1),
})
export type ChatDoneEvent = z.infer<typeof chatDoneEventSchema>

/** Union 10 event cua luong chat. */
export const chatEventSchema = z.discriminatedUnion('type', [
  chatMetaEventSchema,
  chatTokenEventSchema,
  chatCitationEventSchema,
  chatToolCallEventSchema,
  chatToolResultEventSchema,
  chatUsageEventSchema,
  chatProviderSwitchEventSchema,
  chatBudgetEventSchema,
  chatErrorEventSchema,
  chatDoneEventSchema,
])
export type ChatEvent = z.infer<typeof chatEventSchema>

export const CHAT_EVENT_TYPES = [
  'meta',
  'token',
  'citation',
  'tool_call',
  'tool_result',
  'usage',
  'provider_switch',
  'budget',
  'error',
  'done',
] as const
export type ChatEventType = (typeof CHAT_EVENT_TYPES)[number]

/** Type guard cho event bat ky. */
export function isChatEvent(value: unknown): value is ChatEvent {
  return chatEventSchema.safeParse(value).success
}
