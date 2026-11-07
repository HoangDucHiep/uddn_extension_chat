/**
 * Schema Zod cho CRUD conversation (FR-CHAT-08/09/11 — T-M1-09).
 *
 * Dùng chung giữa extension / server / eval → 1 nguồn sự thật cho
 * shape request & response của endpoint `/api/conversations`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.10
 */

import { z } from 'zod'

/** Do dai toi da cua tieu de conversation (ky tu). */
export const MAX_CONVERSATION_TITLE_CHARS = 200

/**
 * Tieu de conversation.
 *
 * Server tu cat con 60 ky tu dau cua cau hoi de tao tieu de mac dinh →
 * client khong can tu sinh tieu de.
 */
export const conversationTitleSchema = z.string().max(MAX_CONVERSATION_TITLE_CHARS)

/**
 * Mot conversation trong danh sach (tom tat — khong kem messages).
 *
 * `messageCount` la so tin nhan trong conversation → UI hien thi
 * "(n tin nhan)" ma khong can tai ve toan bo lich su.
 */
export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  pinned: z.boolean(),
  archived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().int().nonnegative().default(0),
})
export type ConversationSummary = z.infer<typeof conversationSummarySchema>

/** Response cua `GET /api/conversations`. */
export const conversationListResponseSchema = z.object({
  items: z.array(conversationSummarySchema),
  /** Con trong (keyset pagination) — `undefined` khi khong con trang sau. */
  nextCursor: z.string().optional(),
})
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>

/**
 * Body cua `PATCH /api/conversations/:id`.
 *
 * Moi truong deu optional → client chi gui thuoc tinh can doi.
 * Khong cho doi `id`/`createdAt`.
 */
export const updateConversationSchema = z
  .object({
    title: conversationTitleSchema.optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: 'Can it nhat mot truong de cap nhat' },
  )
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>

/**
 * Mot citation da luu cua mot message (FR-CONTEXT-10 — T-M1-09).
 *
 * Khoi phuc chip inline khi tai lai lich su hoi thoai.
 */
export const conversationCitationSchema = z.object({
  index: z.number().int().nonnegative(),
  url: z.string(),
  title: z.string(),
  snippet: z.string(),
  tabId: z.number().int().optional(),
})
export type ConversationCitation = z.infer<typeof conversationCitationSchema>

/**
 * Mot message trong lich su hoi thoai (khoi phuc tu DB).
 *
 * `meta` luu provider/model/token (DP-6) → chip thong tin hien lai khi
 * tai lai conversation.
 */
export const conversationMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  createdAt: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  citations: z.array(conversationCitationSchema).default([]),
  /**
   * Id cua turn chua message nay (T-M1-10).
   *
   * User message + cac bien the assistant cua cung 1 luot hoi–dap chia
   * chung `turnId`.
   */
  turnId: z.string().max(200).optional(),
  /** Chi so bien the assistant trong turn (0-based) — user message luon = 0. */
  variantIndex: z.number().int().nonnegative().optional(),
  /**
   * Message co nam tren duong di active cua conversation khong.
   *
   * `undefined` → coi nhu `true` (du lieu tao truoc T-M1-10).
   */
  active: z.boolean().optional(),
  /** Id cua turn cha (khi sua & gui lai → tao branch). */
  parentTurnId: z.string().max(200).optional(),
  /** Assistant bi stop giua chung → co nut "Tiep tuc". */
  aborted: z.boolean().optional(),
})
export type ConversationMessage = z.infer<typeof conversationMessageSchema>

/**
 * Mot bien the assistant cua 1 turn (T-M1-10 — FR-CHAT-05).
 *
 * Client dung `variantIndex` + `id` de chuyen qua lai cac bien the.
 */
export const conversationVariantSchema = z.object({
  /** Id cua message assistant. */
  id: z.string().uuid(),
  /** Chi so bien the (0-based). */
  variantIndex: z.number().int().nonnegative(),
  /** Noi dung cau tra loi. */
  content: z.string(),
  createdAt: z.string(),
  /** Bien the dang active. */
  active: z.boolean(),
  /** Bi stop giua chung → co nut "Tiep tuc". */
  aborted: z.boolean().optional(),
  citations: z.array(conversationCitationSchema).default([]),
})
export type ConversationVariant = z.infer<typeof conversationVariantSchema>

/**
 * Mot turn (luot hoi–dap) cua conversation (T-M1-10).
 *
 * `onPath` = turn dang nam tren duong di active cua conversation.
 * Turn khong con tren path → nhanh cu (chi doc).
 */
export const conversationTurnSchema = z.object({
  turnId: z.string(),
  /** Id cua user message cua turn. */
  userMessageId: z.string().uuid().optional(),
  /** Noi dung cau hoi. */
  userContent: z.string(),
  /** Id cua turn cha (khi sua & gui lai). */
  parentTurnId: z.string().optional(),
  /** Turn dang tren duong di active. */
  onPath: z.boolean(),
  /** Cac bien the assistant cua turn. */
  variants: z.array(conversationVariantSchema).default([]),
})
export type ConversationTurn = z.infer<typeof conversationTurnSchema>

/** Response cua `GET /api/conversations/:id/messages`. */
export const conversationMessagesResponseSchema = z.object({
  conversation: conversationSummarySchema,
  messages: z.array(conversationMessageSchema),
  /**
   * Duong di active cua conversation — danh sach `turnId` theo thu tu (T-M1-10).
   */
  path: z.array(z.string()).default([]),
  /** Tat ca turn cua conversation (ke ca nhanh cu). */
  turns: z.array(conversationTurnSchema).default([]),
})
export type ConversationMessagesResponse = z.infer<typeof conversationMessagesResponseSchema>

/** Body cua `POST /api/conversations/:id/turns/:turnId/activate`. */
export const activateVariantSchema = z.object({
  /** Chi so bien the can kich hoat. */
  variantIndex: z.number().int().nonnegative(),
})
export type ActivateVariantInput = z.infer<typeof activateVariantSchema>

/** Response cua `POST /api/conversations/:id/turns/:turnId/activate`. */
export const activateVariantResponseSchema = z.object({
  /** Duong di active moi. */
  path: z.array(z.string()).default([]),
  /** Tat ca turn sau khi chuyen bien the. */
  turns: z.array(conversationTurnSchema).default([]),
})
export type ActivateVariantResponse = z.infer<typeof activateVariantResponseSchema>
