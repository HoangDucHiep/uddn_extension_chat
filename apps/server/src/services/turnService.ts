/**
 * Turn service — nhom message theo luot, quan ly bien the & duong di (T-M1-10).
 *
 * Khi nai:
 *  - **turn** = 1 luot hoi–dap (user message + cac bien the assistant).
 *  - **variant** = 1 bien the cau tra loi cua turn (FR-CHAT-05 — regenerate).
 *  - **path** = duong di active cua conversation (FR-CHAT-06 — sua & gui lai
 *    tao branch → cat duong di tai turn cha).
 *
 * Du lieu luu o `messages.meta` (jsonb) + `conversations.meta.path` (jsonb)
 * → KHONG can migration moi.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.11
 */

import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import {
  type ConversationCitation,
  type ConversationMessage,
  type ConversationToolCall,
  type ConversationTurn,
  type ConversationVariant,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { conversations, messages } from '../db/schema.js'

/** Khoa luu duong di active trong `conversations.meta`. */
export const CONVERSATION_PATH_KEY = 'path'

/**
 * Message tho + `meta` thô (tu DB) — dau vao cua `normalizeMessages`.
 */
export interface RawMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  /** Gia tri jsonb thô cua `messages.meta`. */
  meta?: unknown
  provider?: string | undefined
  model?: string | undefined
  tokensIn?: number | undefined
  tokensOut?: number | undefined
  citations?: readonly ConversationCitation[] | undefined
  /**
   * Tool call da luu cua message (FR-TOOLS-02 — T-M2-09).
   *
   * Join tu bang `tool_calls` khi load lich su.
   */
  toolCalls?: readonly ConversationToolCall[] | undefined
}

/**
 * Message da chuan hoa — luon co `turnId` / `variantIndex` / `active`.
 *
 * Message cu (truoc T-M1-10) khong co `meta.turnId` → duoc gan turn goc
 * theo quy tac "user bat dau turn moi, assistant gan vao turn truoc".
 */
export interface NormalizedMessage extends ConversationMessage {
  turnId: string
  variantIndex: number
  active: boolean
}

/** Meta nhung key luu trong `messages.meta`. */
interface MessageMeta {
  turnId?: unknown
  variantIndex?: unknown
  active?: unknown
  parentTurnId?: unknown
  aborted?: unknown
  provider?: unknown
  model?: unknown
  tokensIn?: unknown
  tokensOut?: unknown
  /** Duong di active (chi dung trong `conversations.meta`). */
  path?: unknown
}

/**
 * Doc `messages.meta` cua 1 dong → typed meta (khong dung `any`).
 *
 * @param meta - Gia tri jsonb thô.
 */
function readMeta(meta: unknown): MessageMeta {
  if (typeof meta !== 'object' || meta === null) return {}
  return meta as MessageMeta
}

/**
 * Chuan hoa danh sach message → moi message co `turnId` / `variantIndex` /
 * `active`.
 *
 * - Message co `meta.turnId` → giu nguyen turn do.
 * - Message cu `meta.turnId` (du lieu cu) → gan turn goc: message `user`
 *   bat dau turn moi, message `assistant` gan vao turn truoc do.
 * - `variantIndex` = 0 cho user message; assistant dem theo thu tu trong turn.
 * - `active` mac dinh `true` (du lieu cu khong co khai bao).
 *
 * @param rawMessages - Danh sach message tho.
 */
export function normalizeMessages(rawMessages: readonly RawMessage[]): NormalizedMessage[] {
  const result: NormalizedMessage[] = []
  // So bien the assistant da thay trong tung turn.
  const variantCounters = new Map<string, number>()
  let lastTurnId: string | undefined

  for (const raw of rawMessages) {
    const meta = readMeta(raw.meta)

    let turnId = typeof meta.turnId === 'string' ? meta.turnId : undefined
    if (turnId === undefined) {
      if (raw.role === 'user' || lastTurnId === undefined) {
        turnId = `legacy-${raw.id}`
      } else {
        turnId = lastTurnId
      }
    }
    lastTurnId = turnId

    const isUser = raw.role === 'user'
    let variantIndex = typeof meta.variantIndex === 'number' ? meta.variantIndex : undefined
    if (variantIndex === undefined) {
      if (isUser) {
        variantIndex = 0
      } else {
        const next = variantCounters.get(turnId) ?? 0
        variantCounters.set(turnId, next + 1)
        variantIndex = next
      }
    } else if (!isUser) {
      // Cap nhat dem so bien the de bien the sau khong trung chi so.
      const next = variantCounters.get(turnId) ?? 0
      variantCounters.set(turnId, Math.max(next, variantIndex + 1))
    }

    const active = typeof meta.active === 'boolean' ? meta.active : true

    const provider = typeof meta.provider === 'string' ? meta.provider : raw.provider
    const model = typeof meta.model === 'string' ? meta.model : raw.model
    const tokensIn =
      typeof meta.tokensIn === 'number' ? meta.tokensIn : raw.tokensIn
    const tokensOut =
      typeof meta.tokensOut === 'number' ? meta.tokensOut : raw.tokensOut

    result.push({
      id: raw.id,
      role: raw.role,
      content: raw.content,
      createdAt: raw.createdAt,
      citations: [...(raw.citations ?? [])],
      toolCalls: [...(raw.toolCalls ?? [])],
      turnId,
      variantIndex,
      active,
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(tokensIn !== undefined ? { tokensIn } : {}),
      ...(tokensOut !== undefined ? { tokensOut } : {}),
      ...(typeof meta.parentTurnId === 'string'
        ? { parentTurnId: meta.parentTurnId }
        : {}),
      ...(typeof meta.aborted === 'boolean' ? { aborted: meta.aborted } : {}),
    })
  }

  return result
}

/**
 * Suy ra duong di active tu thu tu message (fallback cho du lieu cu).
 *
 * Duong di = danh sach `turnId` theo thu tu xuat hien lan dau.
 *
 * @param normalized - Message da chuan hoa.
 */
export function derivePath(normalized: readonly NormalizedMessage[]): string[] {
  const path: string[] = []
  const seen = new Set<string>()

  for (const message of normalized) {
    if (seen.has(message.turnId)) continue
    seen.add(message.turnId)
    path.push(message.turnId)
  }

  return path
}

/**
 * Doc `conversations.meta.path` (duong di active).
 *
 * Tra `undefined` khi conversation chua co path (conversation tao truoc
 * T-M1-10) → caller dung `derivePath()`.
 *
 * @param db - Database client.
 * @param conversationId - Id conversation.
 */
export async function readConversationPath(
  db: Database,
  conversationId: string,
): Promise<string[] | undefined> {
  try {
    const rows = await db
      .select({ meta: conversations.meta })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    const meta = readMeta(rows[0]?.meta)
    const path = meta[CONVERSATION_PATH_KEY]
    if (!Array.isArray(path)) return undefined

    return path.filter((item): item is string => typeof item === 'string')
  } catch {
    return undefined
  }
}

/**
 * Ghi duong di active vao `conversations.meta.path`.
 *
 * Ghi de `meta` (khong gop) → path luon la nguon chan su that.
 *
 * @param db - Database client.
 * @param conversationId - Id conversation.
 * @param path - Duong di moi.
 */
export async function rewritePath(
  db: Database,
  conversationId: string,
  path: readonly string[],
): Promise<void> {
  try {
    const rows = await db
      .select({ meta: conversations.meta })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    const meta = readMeta(rows[0]?.meta)
    await db
      .update(conversations)
      .set({
        meta: { ...meta, [CONVERSATION_PATH_KEY]: [...path] },
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning({ id: conversations.id })
  } catch {
    // Ghi path that bai → khong fail luong chat (client van dung path local).
  }
}

/**
 * Chuyen dong tu bang `messages` → `RawMessage`.
 *
 * @param row - Dong tu DB.
 */
function toRawMessage(row: typeof messages.$inferSelect): RawMessage {
  const meta = readMeta(row.meta)
  return {
    id: row.id,
    role: (row.role === 'user' || row.role === 'system' ? row.role : 'assistant') as
      | 'user'
      | 'assistant'
      | 'system',
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    meta: row.meta,
    ...(typeof meta['provider'] === 'string' ? { provider: meta['provider'] } : {}),
    ...(typeof meta['model'] === 'string' ? { model: meta['model'] } : {}),
    ...(typeof meta['tokensIn'] === 'number' ? { tokensIn: meta['tokensIn'] } : {}),
    ...(typeof meta['tokensOut'] === 'number' ? { tokensOut: meta['tokensOut'] } : {}),
  }
}

/**
 * Doc tat ca message cua 1 conversation, da chuan hoa turn.
 *
 * @param db - Database client.
 * @param conversationId - Id conversation.
 */
export async function loadNormalizedMessages(
  db: Database,
  conversationId: string,
): Promise<NormalizedMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.id))

  return normalizeMessages(rows.map(toRawMessage))
}

/**
 * Doc 1 message theo id (dung cho `regenerate` / `continue`).
 *
 * @param db - Database client.
 * @param messageId - Id message.
 */
export async function loadMessage(
  db: Database,
  messageId: string,
): Promise<RawMessage | undefined> {
  const rows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
  const row = rows[0]
  if (row === undefined) return undefined
  return toRawMessage(row)
}

/**
 * Chi so bien the tiep theo cua 1 turn.
 *
 * Chi dem **assistant** variants — user message khong phai bien the.
 *
 * @param normalized - Message da chuan hoa.
 * @param turnId - Id turn.
 */
export function nextVariantIndex(
  normalized: readonly NormalizedMessage[],
  turnId: string,
): number {
  let max = -1
  for (const message of normalized) {
    if (message.turnId !== turnId) continue
    if (message.role === 'user') continue
    if (message.variantIndex > max) max = message.variantIndex
  }
  return max + 1
}

/**
 * Chi so bien the dang active cua 1 turn.
 *
 * Khong co bien the nao active → tra bien the dau tien.
 *
 * @param normalized - Message da chuan hoa.
 * @param turnId - Id turn.
 */
export function activeVariantIndex(
  normalized: readonly NormalizedMessage[],
  turnId: string,
): number {
  let fallback: number | undefined
  for (const message of normalized) {
    if (message.turnId !== turnId) continue
    if (message.role === 'user') continue
    if (message.active) return message.variantIndex
    fallback ??= message.variantIndex
  }
  return fallback ?? 0
}

/**
 * Gom message theo turn → danh sach turn (co bien the).
 *
 * @param normalized - Message da chuan hoa.
 * @param path - Duong di active (danh sach `turnId`).
 */
export function buildTurns(
  normalized: readonly NormalizedMessage[],
  path: readonly string[],
): ConversationTurn[] {
  const pathSet = new Set(path)
  const groups = new Map<string, NormalizedMessage[]>()

  for (const message of normalized) {
    const list = groups.get(message.turnId) ?? []
    list.push(message)
    groups.set(message.turnId, list)
  }

  const turns: ConversationTurn[] = []

  for (const [turnId, list] of groups) {
    const userMessage = list.find((message) => message.role === 'user')
    const assistantMessages = list
      .filter((message) => message.role !== 'user')
      .sort((a, b) => a.variantIndex - b.variantIndex)

    const variants: ConversationVariant[] = assistantMessages.map((message) => ({
      id: message.id,
      variantIndex: message.variantIndex,
      content: message.content,
      createdAt: message.createdAt,
      active: message.active,
      ...(message.aborted !== undefined ? { aborted: message.aborted } : {}),
      citations: message.citations ?? [],
    }))

    const parentTurnId = list.find((message) => message.parentTurnId !== undefined)?.parentTurnId

    turns.push({
      turnId,
      ...(userMessage !== undefined ? { userMessageId: userMessage.id } : {}),
      userContent: userMessage?.content ?? '',
      ...(parentTurnId !== undefined ? { parentTurnId } : {}),
      onPath: pathSet.has(turnId),
      variants,
    })
  }

  return turns
}

/**
 * Chi so bien the active cua tung turn → map `turnId → variantIndex`.
 *
 * @param normalized - Message da chuan hoa.
 */
export function activeVariantMap(
  normalized: readonly NormalizedMessage[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const message of normalized) {
    if (message.role === 'user') continue
    if (message.active) map.set(message.turnId, message.variantIndex)
  }
  return map
}

/**
 * Sinh id turn moi.
 */
export function newTurnId(): string {
  return randomUUID()
}

/**
 * Cap nhat `messages.meta` cua 1 message (gop them, khong ghi de key khac).
 *
 * @param db - Database client.
 * @param messageId - Id message.
 * @param patch - Cac key meta can ghi them.
 */
export async function patchMessageMeta(
  db: Database,
  messageId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    const rows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
    const row = rows[0]
    if (row === undefined) return

    const meta = readMeta(row.meta)
    await db
      .update(messages)
      .set({ meta: { ...meta, ...patch } })
      .where(eq(messages.id, messageId))
      .returning({ id: messages.id })
  } catch {
    // Ghi meta that bai → client van dung state local.
  }
}

/**
 * Cap nhat `messages.meta` cho nhieu message theo id.
 *
 * @param db - Database client.
 * @param updates - Danh sach `{ id, patch }`.
 */
export async function patchMessagesMeta(
  db: Database,
  updates: readonly { id: string; patch: Record<string, unknown> }[],
): Promise<void> {
  for (const update of updates) {
    await patchMessageMeta(db, update.id, update.patch)
  }
}

/**
 * Ghi de noi dung + meta cua 1 message (dung cho `continue` — noi dung
 * cu + phan moi ghep lai).
 *
 * @param db - Database client.
 * @param messageId - Id message.
 * @param content - Noi dung moi.
 * @param patch - Cac key meta can ghi them.
 */
export async function updateMessageContent(
  db: Database,
  messageId: string,
  content: string,
  patch: Record<string, unknown> = {},
): Promise<void> {
  try {
    const rows = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)
    const row = rows[0]
    if (row === undefined) return

    const meta = readMeta(row.meta)
    await db
      .update(messages)
      .set({ content, meta: { ...meta, ...patch } })
      .where(eq(messages.id, messageId))
      .returning({ id: messages.id })
  } catch {
    // Ghi that bai → noi dung da stream ve client van hien thi dung.
  }
}

