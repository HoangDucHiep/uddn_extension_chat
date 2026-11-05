/**
 * Service luu & doc anh dinh kem (FR-VISION-01 — T-M1-24).
 *
 * Anh duoc gui tu client dang base64 trong `messages[].attachments[]`.
 * Server giai ma base64 → luu vao bang `message_attachments` (kieu `bytea`)
 * de:
 *  - tra lai anh cho UI (GET /api/attachments/:id)
 *  - tai len cho provider o cac luot sau (multi-turn voi anh)
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.2, §5
 */

import { and, desc, eq } from 'drizzle-orm'
import {
  VISION,
  type ImageAttachment,
  type ProviderImage,
} from '@sidekick/shared'
import type { Database } from '../db/index.js'
import { messageAttachments } from '../db/schema.js'

/**
 * Giai ma base64 thanh Buffer.
 *
 * `Buffer.from(data, 'base64')` khong throw khi data sai → can kiem tra
 * round-trip de phat hien du lieu hong.
 */
export function decodeBase64Image(data: string): Buffer {
  return Buffer.from(data, 'base64')
}

/**
 * Giai ma base64 → data URL day du cho provider kieu OpenAI.
 *
 * `image_url.url` can co dang `data:<mime>;base64,<data>`.
 */
export function toDataUrl(mimeType: string, data: string): string {
  return `data:${mimeType};base64,${data}`
}

/**
 * Luu anh cua mot message.
 *
 * Id do client sinh → `onConflictDoNothing` de upsert idempotent (retry
 * cung mot request khong tao dong trung).
 *
 * @param db - Database client.
 * @param params - Thong tin message cha + danh sach anh.
 */
export async function persistAttachments(
  db: Database,
  params: {
    conversationId: string
    messageId: string
    attachments: readonly ImageAttachment[]
  },
): Promise<void> {
  if (params.attachments.length === 0) return

    // Kiem tra kich thuoc thuc te cua base64 (khong tin `bytes` tu client).
    // Anh khong hop le bi bo qua (khong chan ca luot chat).
    const valid = params.attachments
      .map((attachment) => ({
        attachment,
        decoded: decodeBase64Image(attachment.data),
      }))
      .filter(({ decoded }) => decoded.byteLength > 0 && decoded.byteLength <= VISION.MAX_IMAGE_BYTES)

    if (valid.length === 0) return

    await db
    .insert(messageAttachments)
    .values(
      valid.map(({ attachment, decoded }, index) => ({
        id: attachment.id,
        messageId: params.messageId,
        conversationId: params.conversationId,
        mimeType: attachment.mimeType,
        // Luu kich thuoc THUC TE (khong tin con so client tu khai bao).
        byteSize: decoded.byteLength,
        ord: index,
        ...(attachment.width !== undefined ? { width: attachment.width } : {}),
        ...(attachment.height !== undefined ? { height: attachment.height } : {}),
        ...(attachment.fileName !== undefined ? { fileName: attachment.fileName } : {}),
        data: decoded,
      })),
    )
    .onConflictDoNothing()
}

/**
 * Tai `limit` anh gan nhat cua mot conversation.
 *
 * Dung cho multi-turn: luot 2 (chi text) van thay anh cua luot 1.
 * Tra ve `undefined` khi conversation khong co anh.
 *
 * @param db - Database client.
 * @param conversationId - Id conversation.
 * @param limit - So anh toi da tai len.
 */
export async function loadRecentAttachments(
  db: Database,
  conversationId: string,
  limit: number = VISION.MAX_IMAGES_PER_MESSAGE,
): Promise<ProviderImage[]> {
  const rows = await db
    .select({
      mimeType: messageAttachments.mimeType,
      data: messageAttachments.data,
      createdAt: messageAttachments.createdAt,
      ord: messageAttachments.ord,
    })
    .from(messageAttachments)
    .where(eq(messageAttachments.conversationId, conversationId))
    .orderBy(desc(messageAttachments.createdAt), desc(messageAttachments.ord))
    .limit(Math.max(1, limit))

  return rows.map((row) => ({
    mimeType: row.mimeType as ProviderImage['mimeType'],
    data: row.data.toString('base64'),
  }))
}

/**
 * Doc mot anh theo id (phuc vu GET /api/attachments/:id).
 *
 * @param db - Database client.
 * @param id - Id anh.
 */
export async function getAttachment(
  db: Database,
  id: string,
): Promise<{ mimeType: string; data: Buffer } | undefined> {
  const rows = await db
    .select({
      mimeType: messageAttachments.mimeType,
      data: messageAttachments.data,
    })
    .from(messageAttachments)
    .where(eq(messageAttachments.id, id))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return undefined

  return { mimeType: row.mimeType, data: row.data }
}

/**
 * Dem so anh cua mot message.
 *
 * Dung cho test + logging.
 */
export async function countAttachments(
  db: Database,
  messageId: string,
): Promise<number> {
  const rows = await db
    .select({ id: messageAttachments.id })
    .from(messageAttachments)
    .where(and(eq(messageAttachments.messageId, messageId)))

  return rows.length
}
