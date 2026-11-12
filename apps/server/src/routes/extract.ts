/**
 * Route trich xuat context — `POST /api/extract/pdf` · `POST /api/extract/youtube`
 * · `POST /api/extract/document`.
 *
 * Nguyen tac quan trong:
 *  - LUON tra HTTP 200 cho loi nghiep vu (PDF scan, khong co caption) →
 *    loi duoc bieu dien trong body `error`. Client (side panel) chi can doc
 *    body, khong phan biet theo status → panel khong bao gio crash.
 *  - Chi tra 400 khi body request sai schema.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §7.3.1, §7.29
 */

import { Router, type Request, type Response } from 'express'
import {
  DOCUMENT,
  ERROR_CODES,
  LIMITS,
  documentExtractRequestSchema,
  extractRequestSchema,
  type DocumentErrorCode,
  type DocumentExtractResponse,
  type ExtractErrorCode,
  type ExtractResponse,
} from '@sidekick/shared'
import { extractDocumentText } from '../lib/documentExtractor.js'
import { extractPdfText } from '../lib/pdfExtractor.js'
import { extractYoutubeTranscript } from '../lib/youtubeExtractor.js'
import { SafeFetchError, readBuffer, safeFetch } from '../lib/safeFetch.js'

export function createExtractRouter(): Router {
  const router = Router()

  router.post('/extract/pdf', async (req: Request, res: Response) => {
    const parsed = extractRequestSchema.safeParse(req.body)
    if (!parsed.success || parsed.data.kind !== 'pdf') {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body trích xuất PDF không hợp lệ',
          details: { issues: parsed.success ? [] : parsed.error.issues },
        },
      })
      return
    }

    try {
      const fetched = await safeFetch(parsed.data.url, {
        maxBytes: LIMITS.MAX_PDF_BYTES,
        timeoutMs: LIMITS.EXTRACT_FETCH_TIMEOUT_MS,
        headers: { Accept: 'application/pdf,*/*' },
      })

      const bytes = await readBuffer(fetched)

      let result
      try {
        result = await extractPdfText(bytes, { maxChars: LIMITS.MAX_EXTRACT_TEXT_CHARS })
      } catch (error) {
        // File khong phai PDF hop le / hong → coi nhu khong doc duoc.
        if (error instanceof SafeFetchError) throw error
        throw new SafeFetchError(
          ERROR_CODES.CONTEXT_PDF_NOT_READABLE,
          'Không đọc được file PDF (corrupt hoặc không phải PDF)',
          422,
        )
      }

      res.status(200).json({
        kind: 'pdf',
        text: result.text,
        truncated: result.truncated,
      })
    } catch (error) {
      respondError(res, 'pdf', error, ERROR_CODES.CONTEXT_PDF_UNREACHABLE)
    }
  })

  router.post('/extract/youtube', async (req: Request, res: Response) => {
    const parsed = extractRequestSchema.safeParse(req.body)
    if (!parsed.success || parsed.data.kind !== 'youtube') {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body trích xuất YouTube không hợp lệ',
          details: { issues: parsed.success ? [] : parsed.error.issues },
        },
      })
      return
    }

    try {
      const result = await extractYoutubeTranscript(parsed.data.url, {
        timeoutMs: LIMITS.EXTRACT_FETCH_TIMEOUT_MS,
      })

      const truncated = result.text.length > LIMITS.MAX_EXTRACT_TEXT_CHARS
      const text = truncated ? result.text.slice(0, LIMITS.MAX_EXTRACT_TEXT_CHARS) : result.text

      const payload: ExtractResponse = {
        kind: 'youtube',
        text,
        truncated,
        ...(result.title !== undefined ? { title: result.title } : {}),
      }
      res.status(200).json(payload)
    } catch (error) {
      respondError(res, 'youtube', error, ERROR_CODES.CONTEXT_TRANSCRIPT_UNAVAILABLE)
    }
  })

  router.post('/extract/document', async (req: Request, res: Response) => {
    const parsed = documentExtractRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Body trích xuất tài liệu không hợp lệ',
          details: { issues: parsed.error.issues },
        },
      })
      return
    }

    const { fileName, mimeType, data } = parsed.data

    // File vuot gioi han kich thuoc → 413 (loi bien, khong phai loi nghiep vu).
    // Kiem tra tren **so byte thuc** sau khi giai ma base64 (4 byte → 3 byte).
    const bytes = Buffer.from(data, 'base64')
    if (bytes.byteLength > DOCUMENT.MAX_BYTES) {
      res.status(413).json({
        error: {
          code: ERROR_CODES.DOCUMENT_TOO_LARGE,
          message: `File vượt giới hạn ${DOCUMENT.MAX_BYTES} byte`,
        },
      })
      return
    }

    try {
      const result = await extractDocumentText(bytes, {
        fileName,
        mimeType,
        maxChars: LIMITS.MAX_EXTRACT_TEXT_CHARS,
        maxExcerptChars: LIMITS.MAX_EXCERPT_CHARS,
      })

      const payload: DocumentExtractResponse = {
        kind: result.kind,
        text: result.text,
        title: fileName,
        excerpt: result.excerpt,
        truncated: result.truncated,
      }
      res.status(200).json(payload)
    } catch (error) {
      respondDocumentError(res, fileName, error)
    }
  })

  return router
}

/**
 * Tra loi loi nghiep vuu cua nhanh tai lieu — HTTP 200 + `error` trong body.
 *
 * @param res - Response cua Express.
 * @param fileName - Ten file (đưa vào message cho dễ hiểu).
 * @param error - Lỗi đã ném.
 */
function respondDocumentError(res: Response, fileName: string, error: unknown): void {
  const code =
    error instanceof SafeFetchError ? asDocumentErrorCode(error.code) : ERROR_CODES.DOCUMENT_NOT_READABLE
  const message = error instanceof Error ? error.message : String(error)

  res.status(200).json({
    kind: 'text',
    text: '',
    truncated: false,
    error: code,
    errorMessage: `Không đọc được "${fileName}": ${message}`,
  })
}

/** Ép error code về danh sách error của nhanh tai lieu. */
function asDocumentErrorCode(code: string): DocumentErrorCode {
  switch (code) {
    case ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE:
      return ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE
    case ERROR_CODES.DOCUMENT_TOO_LARGE:
      return ERROR_CODES.DOCUMENT_TOO_LARGE
    case ERROR_CODES.DOCUMENT_EMPTY:
      return ERROR_CODES.DOCUMENT_EMPTY
    default:
      return ERROR_CODES.DOCUMENT_NOT_READABLE
  }
}

/**
 * Tra loi theo dang `{ error, errorMessage }` nhung van HTTP 200.
 *
 * Client dung `contextError` de hien thi thong bao thay vi nem loi.
 */
function respondError(
  res: Response,
  kind: 'pdf' | 'youtube',
  error: unknown,
  fallbackCode: ExtractErrorCode,
): void {
  if (error instanceof SafeFetchError) {
    res.status(200).json({
      kind,
      text: '',
      truncated: false,
      error: asExtractErrorCode(error.code, fallbackCode),
      errorMessage: error.message,
    })
    return
  }

  const message = error instanceof Error ? error.message : String(error)
  res.status(200).json({
    kind,
    text: '',
    truncated: false,
    error: fallbackCode,
    errorMessage: message,
  })
}

/** Ep error code ve danh sach context error, fallback veo code mac dinh. */
function asExtractErrorCode(code: string, fallback: ExtractErrorCode): ExtractErrorCode {
  switch (code) {
    case ERROR_CODES.CONTEXT_PDF_NOT_READABLE:
      return ERROR_CODES.CONTEXT_PDF_NOT_READABLE
    case ERROR_CODES.CONTEXT_PDF_UNREACHABLE:
      return ERROR_CODES.CONTEXT_PDF_UNREACHABLE
    case ERROR_CODES.CONTEXT_TRANSCRIPT_UNAVAILABLE:
      return ERROR_CODES.CONTEXT_TRANSCRIPT_UNAVAILABLE
    default:
      return fallback
  }
}
