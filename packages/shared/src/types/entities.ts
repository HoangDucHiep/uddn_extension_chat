/**
 * Type dung chung cho conversation / message / citation / tool call.
 * Moi thay doi o day deu phai reflect vao docs/SYSTEM_DESIGN.md §5.
 */

import { z } from 'zod'
import { PROVIDER_IDS } from '../constants.js'

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

/** Provider info (public metadata, khong bao gio lo key). */
export const providerInfoSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  name: z.string(),
  models: z.array(z.string()),
  keySource: z.enum(['K1', 'K2', 'K3']),
  requiresKey: z.boolean(),
  available: z.boolean(),
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
