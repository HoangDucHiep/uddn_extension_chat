/**
 * Zod schema cho request/response cua BFF.
 * Validate tai bien (route handler) theo rule coding-standards.mdc.
 */

import { z } from 'zod'
import { LIMITS, PROVIDER_IDS } from '../constants.js'

/** Mot turn trong hoi thoai gui len BFF. */
export const chatTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(LIMITS.MAX_MESSAGE_CHARS),
})
export type ChatTurn = z.infer<typeof chatTurnSchema>

/** Context trang (tab dang mo). */
export const pageContextSchema = z.object({
  url: z.string().max(LIMITS.MAX_CONTEXT_CHARS),
  title: z.string().max(1000),
  selectedText: z.string().max(LIMITS.MAX_CONTEXT_CHARS).optional(),
  tabId: z.number().int().optional(),
})
export type PageContext = z.infer<typeof pageContextSchema>

/** Body cua POST /api/chat. */
export const chatRequestSchema = z.object({
  messages: z.array(chatTurnSchema).min(1).max(LIMITS.MAX_HISTORY_MESSAGES),
  conversationId: z.string().uuid().optional(),
  provider: z.enum(PROVIDER_IDS).optional(),
  model: z.string().max(200).optional(),
  systemPrompt: z.string().max(LIMITS.MAX_MESSAGE_CHARS).optional(),
  context: pageContextSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(LIMITS.MAX_OUTPUT_TOKENS).optional(),
  stream: z.boolean().optional(),
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
