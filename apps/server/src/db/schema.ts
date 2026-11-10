/**
 * Drizzle schema — Postgres 16 + pgvector.
 *
 * Docs: docs/SYSTEM_DESIGN.md §5 (data model).
 * M0 chi tao cac bang can cho chat + log + luu BYOK key.
 * Cac bang M2/M4 (skills, tools, mcp, rag, workflows, eval) se bo sung o milestone sau.
 */

import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * Cot kieu `bytea` — dung `customType` vi drizzle-orm 0.45 khong export
 * helper `bytea` san (chi co `text`/`jsonb`/numeric...).
 *
 * Driver `pg` tu map `Buffer` <-> `bytea` khi insert/select.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea'
  },
})

/** Timestamp dung chung: luon luu UTC. */
const createdAt = timestamp('created_at', { withTimezone: true })
  .notNull()
  .defaultNow()

/** ------------------------------------------------------------------
 * conversations
 * ---------------------------------------------------------------- */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull().default('Cuộc trò chuyện mới'),
    pinned: boolean('pinned').notNull().default(false),
    archived: boolean('archived').notNull().default(false),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('conversations_archived_updated_idx').on(table.archived, table.updatedAt.desc()),
    index('conversations_pinned_updated_idx').on(table.pinned, table.updatedAt.desc()),
  ],
)

/** ------------------------------------------------------------------
 * messages
 * ---------------------------------------------------------------- */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('user'),
    content: text('content').notNull().default(''),
    meta: jsonb('meta').notNull().default(sql`'{}'::jsonb`),
    createdAt,
  },
  (table) => [
    index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  ],
)

/** ------------------------------------------------------------------
 * citations
 * ---------------------------------------------------------------- */
export const citations = pgTable(
  'citations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull().default(0),
    url: text('url').notNull(),
    title: text('title').notNull().default(''),
    snippet: text('snippet').notNull().default(''),
    tabId: integer('tab_id'),
    score: real('score'),
    createdAt,
  },
  (table) => [index('citations_message_idx').on(table.messageId)],
)

/** ------------------------------------------------------------------
 * tool_calls
 * ---------------------------------------------------------------- */
export const toolCalls = pgTable(
  'tool_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    args: jsonb('args').notNull().default(sql`'{}'::jsonb`),
    output: text('output'),
    status: text('status').notNull().default('pending'),
    approvalRequired: boolean('approval_required').notNull().default(false),
    approvedByUser: boolean('approved_by_user').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [index('tool_calls_message_idx').on(table.messageId)],
)

/** ------------------------------------------------------------------
 * message_attachments — anh dinh kem cua message (FR-VISION-01 — T-M1-24)
 * ---------------------------------------------------------------- */
export const messageAttachments = pgTable(
  'message_attachments',
  {
    /** Id sinh boi client (uuid) → upsert idempotent, render ngay trong UI. */
    id: uuid('id').primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    mimeType: text('mime_type').notNull(),
    /** Kich thuoc byte cua anh goc. */
    byteSize: integer('byte_size').notNull().default(0),
    /** Thu tu anh trong cung 1 message (0, 1, 2...) → sap xep deterministic. */
    ord: integer('ord').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    fileName: text('file_name'),
    /** Du lieu anh goc (khong phai base64) — server tai len de goi provider. */
    data: bytea('data').notNull(),
    createdAt,
  },
  (table) => [
    index('message_attachments_message_idx').on(table.messageId),
    index('message_attachments_conversation_created_idx').on(
      table.conversationId,
      table.createdAt.desc(),
    ),
    uniqueIndex('message_attachments_message_ord_idx').on(table.messageId, table.ord),
  ],
)

/** ------------------------------------------------------------------
 * provider_keys — BYOK ma hoa AES-256-GCM (K2)
 * ---------------------------------------------------------------- */
export const providerKeys = pgTable(
  'provider_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerId: text('provider_id').notNull(),
    label: text('label').notNull().default('default'),
    /** Ciphertext base64. */
    ciphertext: text('ciphertext').notNull(),
    /** IV 12 byte base64. */
    iv: text('iv').notNull(),
    /** Auth tag 16 byte base64. */
    authTag: text('auth_tag').notNull(),
    /** 4 ky tu cuoi cua key de user nhan ra — khong du de su dung. */
    hint: text('hint').notNull().default(''),
    isActive: boolean('is_active').notNull().default(true),
    createdAt,
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('provider_keys_provider_active_idx').on(table.providerId, table.isActive),
    uniqueIndex('provider_keys_provider_label_idx').on(table.providerId, table.label),
  ],
)

/** ------------------------------------------------------------------
 * request_logs — log co cau truc (bat buoc cho eval)
 * ---------------------------------------------------------------- */
export const requestLogs = pgTable(
  'request_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: text('request_id').notNull(),
    conversationId: uuid('conversation_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    keySource: text('key_source').notNull().default('K1'),
    /** Chi luu khi LOG_REQUESTS=true va co che do luu day du duoc bat. */
    promptText: text('prompt_text'),
    contextHash: text('context_hash'),
    contextSnapshot: jsonb('context_snapshot'),
    responseText: text('response_text'),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull().default('0'),
    ttftMs: integer('ttft_ms').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    toolCalls: jsonb('tool_calls'),
    error: text('error'),
    /**
     * Provider **bi loi truoc do** khi server fallback sang provider du phong.
     *
     * T-M2-02 (FR-PROVIDER-04) — `null` neu khong co fallback nao xay ra.
     */
    fallbackFrom: text('fallback_from'),
    createdAt,
  },
  (table) => [
    uniqueIndex('request_logs_request_id_idx').on(table.requestId),
    index('request_logs_created_idx').on(table.createdAt.desc()),
    index('request_logs_provider_created_idx').on(table.provider, table.createdAt.desc()),
  ],
)

/** ------------------------------------------------------------------
 * budget_settings — cau hinh budget cap (FR-PROVIDER-06 — T-M2-03b)
 * ---------------------------------------------------------------- */
export const budgetSettings = pgTable('budget_settings', {
  /**
   * Id cua cau hinh — **singleton** (chi 1 dong, id = `'default'`).
   *
   * Dung `text` pk thay vi uuid de upsert idempotent: server luon ghi vao
   * cung 1 dong → khong sinh rac nhieu dong khi user bam "Luu" nhieu lan.
   */
  id: text('id').primaryKey().default('default'),
  /** Bat/tat budget cap. Mac dinh **TAT** (user chu dong bat). */
  enabled: boolean('enabled').notNull().default(false),
  /** Han muc chi phi (USD) cho ky hien tai. `0` = khong gioi han. */
  limitUsd: numeric('limit_usd', { precision: 12, scale: 6 }).notNull().default('0'),
  /** Nguong canh bao (%) — vuot nguong nay → canh bao. */
  warnThresholdPercent: integer('warn_threshold_percent').notNull().default(80),
  /** Chu ky tinh: `daily` | `monthly`. */
  period: text('period').notNull().default('monthly'),
  /** Khi vuot han muc → chan luot chat moi. */
  hardBlock: boolean('hard_block').notNull().default(true),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** ------------------------------------------------------------------
 * Relations
 * ---------------------------------------------------------------- */
export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  citations: many(citations),
  toolCalls: many(toolCalls),
  attachments: many(messageAttachments),
}))

export const messageAttachmentsRelations = relations(messageAttachments, ({ one }) => ({
  message: one(messages, {
    fields: [messageAttachments.messageId],
    references: [messages.id],
  }),
  conversation: one(conversations, {
    fields: [messageAttachments.conversationId],
    references: [conversations.id],
  }),
}))

export const citationsRelations = relations(citations, ({ one }) => ({
  message: one(messages, { fields: [citations.messageId], references: [messages.id] }),
}))

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  message: one(messages, { fields: [toolCalls.messageId], references: [messages.id] }),
}))

export type ConversationRow = typeof conversations.$inferSelect
export type NewConversationRow = typeof conversations.$inferInsert
export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert
export type CitationRow = typeof citations.$inferSelect
export type ToolCallRow = typeof toolCalls.$inferSelect
export type MessageAttachmentRow = typeof messageAttachments.$inferSelect
export type NewMessageAttachmentRow = typeof messageAttachments.$inferInsert
export type ProviderKeyRow = typeof providerKeys.$inferSelect
export type NewProviderKeyRow = typeof providerKeys.$inferInsert
export type RequestLogRow = typeof requestLogs.$inferSelect
export type NewRequestLogRow = typeof requestLogs.$inferInsert
export type BudgetSettingsRow = typeof budgetSettings.$inferSelect
export type NewBudgetSettingsRow = typeof budgetSettings.$inferInsert
