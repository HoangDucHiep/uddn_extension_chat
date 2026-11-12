/**
 * Contract trich xuat tai lieu dinh kem (FR-CONTEXT-14 — T-M2-23).
 *
 * Khac voi anh (FR-VISION-01 — T-M1-24), tai lieu duoc **chuyen thanh text**
 * o server roi dua vao `context.items[]` voi `kind: 'file'` → thu huong
 * ngan sach context + prompt assembly + citation (khong luu DB).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

import { z } from 'zod'
import { ERROR_CODES } from '../errors.js'

/**
 * Loai tai lieu server biet cach trich xuat.
 *
 * - `pdf`  → parse bang `pdfjs-dist` (T-M1-21).
 * - `docx` → parse bang `mammoth` (OOXML).
 * - `text` → giai ma UTF-8 (txt / md / csv).
 */
export const DOCUMENT_KINDS = ['pdf', 'docx', 'text'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/**
 * Error code rieng cho nhanh trich xuat tai lieu.
 *
 * Re-use `ERROR_CODES` de client chi can mot bo error code chuan
 * (rule backend: moi loi ra ngoai deu map ve error code trong `errors.ts`).
 */
export const DOCUMENT_ERROR_CODES = {
  /** Khong phai dinh dang tai lieu duoc phep (vd `.xlsx`, `.doc` binary). */
  DOCUMENT_UNSUPPORTED_TYPE: ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE,
  /** File vuot gioi han kich thuoc. */
  DOCUMENT_TOO_LARGE: ERROR_CODES.DOCUMENT_TOO_LARGE,
  /** File hong / khong doc duoc noi dung (vd PDF scan khong co text layer). */
  DOCUMENT_NOT_READABLE: ERROR_CODES.DOCUMENT_NOT_READABLE,
  /** File khong co noi dung text nao. */
  DOCUMENT_EMPTY: ERROR_CODES.DOCUMENT_EMPTY,
} as const

export type DocumentErrorCode = (typeof DOCUMENT_ERROR_CODES)[keyof typeof DOCUMENT_ERROR_CODES]

/**
 * Body cua `POST /api/extract/document`.
 *
 * `data` la **base64 thuan** (khong co prefix `data:...;base64,`) →
 * server decode truc tiep ra byte de sniff magic number + parse.
 */
export const documentExtractRequestSchema = z.object({
  /** Ten file goc (dung lam tieu de context item + hien thi tren chip). */
  fileName: z.string().min(1).max(255),
  /** MIME type do trinh duyet cung cap (co the rong). */
  mimeType: z.string().max(120),
  /**
   * Noi dung file dang base64.
   *
   * Khong gioi han do dai o day: khoi han byte thuc (413) do route lo —
   * `express.json` da chan body qua 16 MB truoc khi vao handler.
   */
  data: z.string().min(1),
})
export type DocumentExtractRequest = z.infer<typeof documentExtractRequestSchema>

/**
 * Response cua `POST /api/extract/document`.
 *
 * LUON tra 200: loi nghiep vụ (file hong, sai dinh dang, rong) duoc bieu dien
 * bang `error` trong body de client khong phai phan biet HTTP status.
 * Chi body sai moi tra 400.
 */
export const documentExtractResponseSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  /** Noi dung da trich (co the rong khi that bai). */
  text: z.string(),
  /** Tieu de (fallback ve ten file khi server khong doc duoc metadata). */
  title: z.string().optional(),
  /** Trich dan ngan de preview tren chip. */
  excerpt: z.string().optional(),
  /** Da cat bot vi qua gioi han do dai. */
  truncated: z.boolean(),
  error: z.enum(DOCUMENT_ERROR_CODES).optional(),
  errorMessage: z.string().optional(),
})
export type DocumentExtractResponse = z.infer<typeof documentExtractResponseSchema>
