/**
 * Helper xu ly tai lieu dinh kem tu may (FR-CONTEXT-14 — T-M2-23).
 *
 * Ho tro 3 duong vao (giong anh — FR-VISION-01 / T-M1-24):
 *  - paste tu clipboard
 *  - drag & drop vao composer
 *  - file picker
 *
 * Khac voi anh: tai lieu duoc **gui len BFF de parse** (PDF/DOCX khong parse
 * duoc trong browser) → server tra ve text → extension dua vao context
 * voi `kind: 'file'`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

import {
  API_ROUTES,
  DOCUMENT,
  ERROR_CODES,
  type DocumentExtractResponse,
} from '@sidekick/shared'
import { ApiError, fetchJson } from './apiClient.js'
import { stripDataUrlPrefix } from './imageUpload.js'

/** Ket qua validate mot file tai lieu. */
export type DocumentValidationResult =
  | { ok: true; kind: 'pdf' | 'docx' | 'text' }
  | { ok: false; code: string; message: string }

/**
 * Doan duoi file (khong phan biet hoa thuong) — dung chung quy tac voi
 * server (`apps/server/src/lib/documentExtractor.ts`).
 *
 * @param fileName - Ten file.
 * @returns Duoi file (voi dau `.`) hoac chuoi rong.
 */
export function documentExtensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const dotIndex = base.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return base.slice(dotIndex).toLowerCase()
}

/**
 * Doan loai tai lieu tu duoi file.
 *
 * @param fileName - Ten file.
 * @returns Loai tai lieu hoac `undefined` khi khong ho tro.
 */
export function documentKindOf(fileName: string): 'pdf' | 'docx' | 'text' | undefined {
  const extension = documentExtensionOf(fileName)
  if (extension === '.pdf') return 'pdf'
  if (extension === '.docx') return 'docx'
  if (extension === '.txt' || extension === '.md' || extension === '.csv') return 'text'
  return undefined
}

/**
 * Kiem tra file co phai tai lieu duoc phep khong.
 *
 * Dung o `Composer` de loc file tu paste / drag-drop (chi nhan file duoc
 * ho tro thoi — file la thu khac thi bo qua, khong preventDefault).
 *
 * @param file - File can kiem tra.
 */
export function isDocumentFile(file: File): boolean {
  return documentKindOf(file.name) !== undefined
}

/**
 * Kiem tra file co phai tai lieu duoc phep khong.
 *
 * Khong bao gio throw — tra ve error code de UI hien thi thong bao.
 *
 * @param file - File can kiem tra.
 */
export function validateDocumentFile(file: File): DocumentValidationResult {
  const kind = documentKindOf(file.name)
  if (kind === undefined) {
    return {
      ok: false,
      code: ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE,
      message: `Dinh dang "${documentExtensionOf(file.name) || file.type || 'khong ro'}" khong duoc ho tro. Chi nhan PDF, DOCX, TXT, MD, CSV.`,
    }
  }

  if (file.size > DOCUMENT.MAX_BYTES) {
    return {
      ok: false,
      code: ERROR_CODES.DOCUMENT_TOO_LARGE,
      message: `Tai lieu vuot qua ${Math.round(DOCUMENT.MAX_BYTES / 1_000_000)} MB. Hay chon tai lieu nho hon.`,
    }
  }

  if (file.size === 0) {
    return {
      ok: false,
      code: ERROR_CODES.DOCUMENT_EMPTY,
      message: 'Tai lieu rong — khong the dinh kem.',
    }
  }

  return { ok: true, kind }
}

/**
 * Doc file thanh base64 thuan (khong co prefix `data:...;base64,`).
 *
 * @param file - File can doc.
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = (): void => {
      reject(new Error('Khong doc duoc tep.'))
    }

    reader.onload = (): void => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Khong doc duoc tep.'))
        return
      }
      resolve(stripDataUrlPrefix(result))
    }

    reader.readAsDataURL(file)
  })
}

/** Ket qua trich xuat tai lieu — `error` co nghia la that bai (khong phai throw). */
export interface DocumentExtractOutcome {
  text: string
  title: string | undefined
  excerpt: string | undefined
  truncated: boolean
  error: string | undefined
  errorMessage: string | undefined
}

/**
 * Trich xuat noi dung tai lieu qua BFF.
 *
 * Khong bao gio throw — moi loi duoc doi thanh `error` de panel van chat
 * duoc (chi mat context, khong mat chuc nang).
 *
 * @param file - File can trich xuat.
 */
export async function requestDocumentExtract(file: File): Promise<DocumentExtractOutcome> {
  let data: string
  try {
    data = await readFileAsBase64(file)
  } catch (error) {
    return {
      text: '',
      title: undefined,
      excerpt: undefined,
      truncated: false,
      error: ERROR_CODES.DOCUMENT_NOT_READABLE,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    const payload = await fetchJson<DocumentExtractResponse>(API_ROUTES.extractDocument, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type,
        data,
      }),
    })

    return {
      text: payload.text,
      title: payload.title,
      excerpt: payload.excerpt,
      truncated: payload.truncated,
      error: payload.error,
      errorMessage: payload.errorMessage,
    }
  } catch (error) {
    // BFF khong phat (offline) hoac body sai → bao loi chung, khong lam chat that bai.
    if (error instanceof ApiError) {
      return {
        text: '',
        title: undefined,
        excerpt: undefined,
        truncated: false,
        error: error.code,
        errorMessage: error.message,
      }
    }

    return {
      text: '',
      title: undefined,
      excerpt: undefined,
      truncated: false,
      error: ERROR_CODES.DOCUMENT_NOT_READABLE,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }
}
