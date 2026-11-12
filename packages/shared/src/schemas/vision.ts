/**
 * Zod schema cho contract anh dinh kem (FR-VISION-01 — T-M1-24).
 *
 * Anh duoc gui inline (base64) trong `messages[].attachments[]` cua
 * `POST /api/chat`. Server luu vao bang `message_attachments` de tra lai
 * duoc sau khi reload panel / mo lai lich su conversation.
 *
 * Luu y: anh KHONG phai `ContextItem` — no la dau vao truc tiep cua cau
 * hoi, khong phu thuoc toggle `contextEnabled`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.4
 */

import { z } from 'zod'
import { VISION, VISION_MIME_TYPES } from '../constants.js'

/** Cac MIME type duoc phep cho anh dinh kem. */
export const IMAGE_MIME_TYPES = VISION_MIME_TYPES
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number]

/**
 * Do dai toi da cua chuoi base64 (ky tu).
 *
 * Base64 dai gap 4/3 so voi byte goc → gioi han byte 5 MB ~ 6.7 MB chuoi.
 * Schema dung gioi han nay de reject payload qua lon **truoc** khi validate
 * tung field (Zod string max chay truoc).
 */
export const MAX_IMAGE_BASE64_CHARS = Math.ceil((VISION.MAX_IMAGE_BYTES * 4) / 3) + 1024

/**
 * Mot anh dinh kem trong mot turn hoi thoai.
 *
 * `data` la base64 **thuan** (khong co prefix `data:<mime>;base64,`) de
 * provider adapter tu dung dang can dung (Gemini `inline_data` vs OpenAI
 * `image_url.url`).
 */
export const imageAttachmentSchema = z.object({
  /** Id dinh danh — client sinh (uuid) de server upsert idempotent. */
  id: z.string().uuid(),
  /** Loai anh. */
  mimeType: z.enum(IMAGE_MIME_TYPES),
  /** Du lieu base64 thuan (khong prefix data URL). */
  data: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
  /** Kich thuoc byte cua anh goc. */
  bytes: z.number().int().positive().max(VISION.MAX_IMAGE_BYTES),
  /** Chieu rong anh (px) — dung de hien thi preview. */
  width: z.number().int().positive().optional(),
  /** Chieu cao anh (px) — dung de hien thi preview. */
  height: z.number().int().positive().optional(),
  /** Ten file goc (de hien thi cho user). */
  fileName: z.string().max(255).optional(),
})
export type ImageAttachment = z.infer<typeof imageAttachmentSchema>

/**
 * Anh phia server tra ve cho provider — chi con phan can de goi API.
 *
 * Server giu `data` trong DB (bytea) va tai day khi goi provider.
 */
export const providerImageSchema = z.object({
  mimeType: z.enum(IMAGE_MIME_TYPES),
  data: z.string().min(1),
})
export type ProviderImage = z.infer<typeof providerImageSchema>

/**
 * Schema danh sach anh dinh kem cho mot turn.
 *
 * Gioi han so luong va tong byte duoc ap trong `packages/shared` de ca
 * extension (validate som) va server (validate lai o bien) cung dung mot
 * quy tac.
 */
export const imageAttachmentListSchema = z
  .array(imageAttachmentSchema)
  .max(VISION.MAX_IMAGES_PER_MESSAGE)
  .superRefine((items, ctx) => {
    const total = items.reduce((sum, item) => sum + item.bytes, 0)
    if (total > VISION.MAX_TOTAL_IMAGE_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: `Tổng kích thước ảnh vượt giới hạn ${VISION.MAX_TOTAL_IMAGE_BYTES} byte`,
      })
    }
  })
export type ImageAttachmentList = z.infer<typeof imageAttachmentListSchema>
