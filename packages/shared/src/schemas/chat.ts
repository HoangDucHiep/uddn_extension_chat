/**
 * Zod schema cho request/response cua BFF.
 * Validate tai bien (route handler) theo rule coding-standards.mdc.
 */

import { z } from 'zod'
import { LIMITS, MAX_CONTEXT_ITEMS, PROVIDER_IDS } from '../constants.js'
import { clampExcerpt } from '../excerpt.js'
import { PAGE_KINDS } from '../pageKind.js'
import { imageAttachmentListSchema } from './vision.js'

/**
 * Loai cua mot context item — quyet dinh icon + nhan tren chip.
 *
 * `selection` → doan da boi den · `tab` → tab dinh kem · `file` → file dinh kem.
 */
export const CONTEXT_ITEM_KINDS = ['selection', 'tab', 'file'] as const
export type ContextItemKind = (typeof CONTEXT_ITEM_KINDS)[number]

/**
 * Thu tu uu tien cua mot context item khi cat bot (cao → thap).
 *
 * `selection` > `attachment` > `currentTab`. `history` duoc xu ly rieng boi
 * `trimHistory` (khong phai la item).
 */
export const CONTEXT_ITEM_TIERS = ['selection', 'attachment', 'currentTab'] as const
export type ContextItemTier = (typeof CONTEXT_ITEM_TIERS)[number]


/** Mot turn trong hoi thoai gui len BFF. */
export const chatTurnSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(LIMITS.MAX_MESSAGE_CHARS),
  /**
   * Anh dinh kem cua turn nay (FR-VISION-01 — T-M1-24).
   *
   * Chi turn `user` moi co anh. Anh khong phai `ContextItem` → khong phu
   * thuoc toggle `contextEnabled`.
   */
  attachments: imageAttachmentListSchema.optional(),
})
export type ChatTurn = z.infer<typeof chatTurnSchema>

/** Context trang (tab dang mo). */
export const pageContextSchema = z.object({
  url: z.string().max(LIMITS.MAX_CONTEXT_CHARS),
  title: z.string().max(1000),
  selectedText: z.string().max(LIMITS.MAX_CONTEXT_CHARS).optional(),
  /** Noi dung chinh da trich xuat tu trang (FR-CONTEXT-01). */
  text: z.string().max(LIMITS.MAX_PAGE_TEXT_CHARS).optional(),
  /** Trich dan ngan de preview trong UI (chip context) — tu cat neu vuot han. */
  excerpt: z
    .string()
    .transform((value) => clampExcerpt(value, LIMITS.MAX_EXCERPT_CHARS))
    .optional(),
  tabId: z.number().int().optional(),
  /** Loai trang da trich xuat — `html` | `pdf` | `youtube` (FR-CONTEXT-05/06). */
  sourceKind: z.enum(PAGE_KINDS).optional(),
  /** Error code khi trich xuat that bai — UI hien thi thong bao (khong nem loi). */
  contextError: z.string().max(200).optional(),
  /** Thong diep loi thien nhan cho nguoi dung. */
  contextErrorMessage: z.string().max(500).optional(),
})
export type PageContext = z.infer<typeof pageContextSchema>

/**
 * Mot context item duoc user dinh kem (FR-CONTEXT-07).
 *
 * `tier` quyet dinh thu tu uu tien khi cat bot:
 *  - `selection` → doan da boi den (cao nhat)
 *  - `attachment` → tab / file user dinh kem
 *  - `currentTab` → tab hien tai (chi dung khi user bam "Them trang nay")
 */
export const contextItemSchema = z.object({
  /** Id dinh danh item (de goi xoa / cap nhat trong UI). */
  id: z.string().min(1).max(200),
  /** Loai item — quyet dinh icon tren chip. */
  kind: z.enum(CONTEXT_ITEM_KINDS),
  /** Hang uu tien khi cat bot. */
  tier: z.enum(CONTEXT_ITEM_TIERS),
  url: z.string().max(LIMITS.MAX_CONTEXT_CHARS).optional(),
  title: z.string().max(1000),
  /** Noi dung chinh da trich xuat (co the bi cat bo). */
  text: z.string().max(LIMITS.MAX_PAGE_TEXT_CHARS).optional(),
  /**
   * Trich dan ngan de preview tren chip.
   *
   * **Tu cat** thay vi reject khi vuot gioi han (fix T-M2-23): truoc day nhieu
   * noi cat `slice(0, 500)` roi **them** `"..."` → 503 ky tu → schema reject
   * → `POST /api/chat` tra 400 "Body chat không hợp lệ" → **panel khong chat
   * duoc** sau khi dinh kem tai lieu.
   *
   * `excerpt` chi dung de **preview** → cat bot khong lam mat thong tin quan
   * trong (`text` van giu nguyen) → an toan hon reject ca request.
   */
  excerpt: z
    .string()
    .transform((value) => clampExcerpt(value, LIMITS.MAX_EXCERPT_CHARS))
    .optional(),
  /** Loai trang da trich xuat — `html` | `pdf` | `youtube` (FR-CONTEXT-05/06). */
  sourceKind: z.enum(PAGE_KINDS).optional(),
  /** Ten file goc (chi co khi `kind: 'file'` — FR-CONTEXT-14). */
  fileName: z.string().max(255).optional(),
  /** MIME type cua file goc (chi co khi `kind: 'file'` — FR-CONTEXT-14). */
  mimeType: z.string().max(120).optional(),
  tabId: z.number().int().optional(),
})
export type ContextItem = z.infer<typeof contextItemSchema>

/**
 * Bundle context gui len BFF — danh sach item user dinh kem.
 *
 * Chu khong co `items` → khong gui context (chat thuan LLM).
 */
export const contextBundleSchema = z.object({
  items: z.array(contextItemSchema).max(MAX_CONTEXT_ITEMS),
})
export type ContextBundle = z.infer<typeof contextBundleSchema>

/**
 * Chuan hoa `context` cua request thanh bundle.
 *
 * Backward compatible: nhan ca shape moi (`{ items: [...] }`) va shape cu
 * (`{ url, title, text, ... }` cua 1 trang) → boc thanh `items[0]`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */
export function normalizeContext(value: unknown): unknown {
  if (value === undefined || value === null) return value
  if (typeof value !== 'object') return value

  const record = value as Record<string, unknown>
  // Shape moi — giu nguyen, schema se validate.
  if (Array.isArray(record['items'])) return value

  const legacy = pageContextSchema.safeParse(value)
  if (!legacy.success) return value

  const items: ContextItem[] = []
  const selectedText = legacy.data.selectedText

  if (selectedText !== undefined && selectedText.length > 0) {
    items.push({
      id: 'legacy-selection',
      kind: 'selection',
      tier: 'selection',
      title: legacy.data.title,
      text: selectedText,
    })
  }

  items.push({
    id: 'legacy-page',
    kind: 'tab',
    tier: 'currentTab',
    url: legacy.data.url,
    title: legacy.data.title,
    ...(legacy.data.text !== undefined ? { text: legacy.data.text } : {}),
    ...(legacy.data.excerpt !== undefined ? { excerpt: legacy.data.excerpt } : {}),
    ...(legacy.data.sourceKind !== undefined ? { sourceKind: legacy.data.sourceKind } : {}),
    ...(legacy.data.tabId !== undefined ? { tabId: legacy.data.tabId } : {}),
  })

  return { items }
}

/**
 * Loai thao tac chat (FR-CHAT-05/06/07 — T-M1-10).
 *
 * - `send` — luot moi: tao user message + assistant moi.
 * - `regenerate` — sinh lai cau tra loi cua 1 turn (them bien the).
 * - `continue` — tiep tuc cau tra loi da bi stop giua chung.
 * - `branch` — sua & gui lai: tao turn moi, cat duong di hien tai.
 */
export const chatOperationSchema = z.enum(['send', 'regenerate', 'continue', 'branch'])
export type ChatOperation = z.infer<typeof chatOperationSchema>

/** Body cua POST /api/chat. */
export const chatRequestSchema = z.object({
  messages: z.array(chatTurnSchema).min(1).max(LIMITS.MAX_HISTORY_MESSAGES),
  conversationId: z.string().uuid().optional(),
  provider: z.enum(PROVIDER_IDS).optional(),
  model: z.string().max(200).optional(),
  systemPrompt: z.string().max(LIMITS.MAX_MESSAGE_CHARS).optional(),
  /** Context dang kem — bundle `{ items: [...] }` (shape cu van duoc ho tro). */
  context: z.preprocess(normalizeContext, contextBundleSchema.optional()),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(LIMITS.MAX_OUTPUT_TOKENS).optional(),
  stream: z.boolean().optional(),
  /**
   * Thao tac cua luot chat (T-M1-10).
   *
   * `undefined` → server coi nhu `'send'` (tuong thich voi client cu).
   */
  operation: chatOperationSchema.optional(),
  /**
   * Id cua assistant message can thao tac (`regenerate` / `continue`).
   */
  assistantMessageId: z.string().uuid().optional(),
  /**
   * Id cua turn cha khi sua & gui lai (`branch`) — turn moi thay the
   * duong di tai turn cha.
   */
  parentTurnId: z.string().max(200).optional(),
  /**
   * Skill duoc chon trong menu `/` (FR-SKILL-01 — T-M2-04).
   *
   * Server **resolve** skill → noi `prompt_template` vao system prompt +
   * ap dung `model` cua skill (neu co). Client khong gui template.
   */
  skillId: z.string().uuid().optional(),
})
export type ChatRequest = z.infer<typeof chatRequestSchema>

/** Response cua GET /api/health. */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  version: z.string(),
  db: z.enum(['up', 'down']),
  uptime: z.number().nonnegative(),
  providers: z.array(z.string()).optional(),
})
export type HealthResponse = z.infer<typeof healthResponseSchema>

/** Query cua GET /api/conversations. */
export const conversationListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(200).optional(),
  /**
   * Loc conversation theo trang thai luu tru (FR-CHAT-09 — T-M1-09).
   *
   * `true` → tra conversation da luu tru; mac dinh `false` → chi tra
   * conversation dang dung.
   */
  archived: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true'),
})
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>

/** Body tao conversation. */
export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
})
export type CreateConversationInput = z.infer<typeof createConversationSchema>

/** Body luu provider key (BYOK). */
export const saveProviderKeySchema = z.object({
  providerId: z.enum(PROVIDER_IDS),
  apiKey: z.string().min(8).max(500),
  label: z.string().max(100).optional(),
})
export type SaveProviderKeyInput = z.infer<typeof saveProviderKeySchema>
