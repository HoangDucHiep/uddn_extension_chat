/**
 * Zod schema cho contract trich xuat context PDF / transcript YouTube.
 *
 * Hai nhanh nay khong the chay trong content script (PDF viewer la plugin
 * native cua Chrome; transcript nam trong player response) → BFF trich xuat
 * roi chuan hoa ve cung shape `context.text` voi nhanh HTML.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.3.1
 */

import { z } from 'zod'
import { ERROR_CODES } from '../errors.js'
import { EXTRACTABLE_KINDS } from '../pageKind.js'

/**
 * Error code rieng cho nhanh trich xuat PDF / YouTube.
 *
 * Re-use `ERROR_CODES` de client chi can mot bo error code chuan
 * (rule backend: moi loi ra ngoai deu map ve error code trong `errors.ts`).
 */
export const EXTRACT_ERROR_CODES = {
  /** PDF khong co text layer (PDF scan) → can upload anh. */
  CONTEXT_PDF_NOT_READABLE: ERROR_CODES.CONTEXT_PDF_NOT_READABLE,
  /** Khong fetch duoc PDF (file noi bo, may chu chan, het quyen) → bao ro. */
  CONTEXT_PDF_UNREACHABLE: ERROR_CODES.CONTEXT_PDF_UNREACHABLE,
  /** Video khong co caption / bi geo-block / video rieng tu → bao ro. */
  CONTEXT_TRANSCRIPT_UNAVAILABLE: ERROR_CODES.CONTEXT_TRANSCRIPT_UNAVAILABLE,
  /** Loi chung (parse that bai, mang loi,...) → bao ro. */
  CONTEXT_EXTRACT_FAILED: ERROR_CODES.CONTEXT_EXTRACT_FAILED,
} as const

export type ExtractErrorCode = (typeof EXTRACT_ERROR_CODES)[keyof typeof EXTRACT_ERROR_CODES]

/** Body cua POST /api/extract/*. */
export const extractRequestSchema = z.object({
  kind: z.enum(EXTRACTABLE_KINDS),
  url: z.string().url().max(2000),
})
export type ExtractRequest = z.infer<typeof extractRequestSchema>

/**
 * Response cua POST /api/extract/*.
 *
 * LUON tra 200: loi nghiep vu (PDF scan, khong co caption) duoc bieu dien
 * bang `error` trong body de client khong phai phan biet HTTP status.
 * Chi body sai moi tra 400.
 */
export const extractResponseSchema = z.object({
  kind: z.enum(EXTRACTABLE_KINDS),
  /** Noi dung da trich (co the rong khi that bai). */
  text: z.string(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  /** Da cat bot vi qua gioi han do dai. */
  truncated: z.boolean(),
  error: z.enum(EXTRACT_ERROR_CODES).optional(),
  errorMessage: z.string().optional(),
})
export type ExtractResponse = z.infer<typeof extractResponseSchema>
