/**
 * Trich xuat text tu tai lieu dinh kem (FR-CONTEXT-14 — T-M2-23).
 *
 * Khac voi nhanh `pdfExtractor.ts` (T-M1-21) lay bytes tu URL, nhanh nay
 * nhan **file local** do user upload tu side panel → base64 → decode bytes.
 *
 * Chi ho tro "core": `pdf` · `docx` · `txt`/`md`/`csv`.
 *  - PDF  → `pdfjs-dist` (tai dung `extractPdfText` — T-M1-21).
 *  - DOCX → `mammoth` (OOXML; `.doc` binary khong ho tro).
 *  - Text → `TextDecoder` UTF-8 (co BOM handling + chan binary).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

import { ERROR_CODES, clampExcerpt, type DocumentKind } from '@sidekick/shared'
import { extractPdfText } from './pdfExtractor.js'
import { SafeFetchError } from './safeFetch.js'

/** Ket qua trich xuat tai lieu. */
export interface DocumentExtractionResult {
  /** Loai tai lieu da xu ly. */
  kind: DocumentKind
  /** Noi dung text (da cat theo gioi han do dai). */
  text: string
  /** Trich dan ngan de preview tren chip. */
  excerpt: string
  /** Da cat bot vi qua gioi han do dai. */
  truncated: boolean
  /** So trang (chi co voi PDF). */
  pageCount: number | undefined
}

/** Tuy chon trich xuat tai lieu. */
export interface DocumentExtractionOptions {
  /** Ten file goc (dung de suy ra dinh dang + tieu de). */
  fileName: string
  /** MIME type (chi tham khao — dinh dang duoc quyet dinh bang magic byte). */
  mimeType: string
  /** Do dai toi da cua text sau khi trich (ky tu). */
  maxChars: number
  /** Do dai toi da cua excerpt (ky tu). */
  maxExcerptChars: number
}

/** Magic byte cua PDF. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46] // %PDF

/** Magic byte cua ZIP (docx / xlsx / pptx deu la ZIP). */
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] // PK\x03\x04

/**
 * Doan cuoi cua ten file (khong phan biet hoa thuong).
 *
 * @param fileName - Ten file.
 * @returns Duoi file (voi dau `.`) hoac chuoi rong.
 */
export function fileExtensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const dotIndex = base.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return base.slice(dotIndex).toLowerCase()
}

/**
 * Kiem tra byte dau co khop magic byte hay khong.
 *
 * @param bytes - Buffer can kiem tra.
 * @param magic - Magic byte mong doi.
 */
function hasMagic(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((byte, index) => bytes[index] === byte)
}

/**
 * Doan dinh dang cua tai lieu.
 *
 * Uu tien **magic byte** (chac chan) → sau do moi dung duoi file.
 * MIME type khong duoc tin: nhieu OS tra `application/octet-stream` cho
 * `.md` / `.csv` → duoi file moi la thong tin duy nhat khi khong phai
 * PDF / ZIP.
 *
 * @param fileName - Ten file.
 * @param bytes - Noi dung file.
 * @returns Loai tai lieu hoac `undefined` khi khong ho tro.
 */
export function detectDocumentKind(
  fileName: string,
  bytes: Uint8Array,
): DocumentKind | undefined {
  if (hasMagic(bytes, PDF_MAGIC)) return 'pdf'

  const extension = fileExtensionOf(fileName)
  if (extension === '.pdf') return 'pdf'

  // ZIP: chi docx duoc ho tro (xlsx / pptx nam ngoai pham vi "core").
  if (hasMagic(bytes, ZIP_MAGIC) || extension === '.docx') {
    return extension === '.docx' ? 'docx' : undefined
  }

  if (extension === '.txt' || extension === '.md' || extension === '.csv') return 'text'

  return undefined
}

/**
 * Trich xuat text tu tai lieu.
 *
 * Loi nghiep vu duoc nem ra bang `SafeFetchError` voi error code chuan de
 * route chuyen thanh HTTP 200 + `error` trong body.
 *
 * @param bytes - Noi dung file.
 * @param options - Tuy chon trich xuat.
 */
export async function extractDocumentText(
  bytes: Uint8Array,
  options: DocumentExtractionOptions,
): Promise<DocumentExtractionResult> {
  const kind = detectDocumentKind(options.fileName, bytes)
  if (kind === undefined) {
    throw new SafeFetchError(
      ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE,
      `Dinh dang khong ho tro: "${options.fileName}". Chi ho tro PDF, DOCX, TXT, MD, CSV.`,
      400,
    )
  }

  const raw = await extractRawText(kind, bytes, options)
  const normalized = normalizeText(raw.text)

  if (normalized.length === 0) {
    throw new SafeFetchError(
      ERROR_CODES.DOCUMENT_EMPTY,
      `File "${options.fileName}" khong co noi dung text nao.`,
      422,
    )
  }

  const truncated = normalized.length > options.maxChars
  const text = truncated ? normalized.slice(0, options.maxChars) : normalized
  // `clampExcerpt` bao dam `excerpt` **khong vuot** `maxExcerptChars` (ke ca
  // sau khi them dau `...`) → `contextItemSchema` (shared) khong reject →
  // `POST /api/chat` khong tra 400.
  const excerpt = clampExcerpt(text, options.maxExcerptChars)

  return {
    kind,
    text,
    excerpt,
    truncated,
    pageCount: raw.pageCount,
  }
}

/** Text thô + metadata (chi PDF moi co so trang). */
interface RawText {
  text: string
  pageCount: number | undefined
}

/**
 * Trich xuat text thô theo tung loai tai lieu.
 *
 * @param kind - Loai tai lieu.
 * @param bytes - Noi dung file.
 * @param options - Tuy chon trich xuat.
 */
async function extractRawText(
  kind: DocumentKind,
  bytes: Uint8Array,
  options: DocumentExtractionOptions,
): Promise<RawText> {
  if (kind === 'pdf') {
    try {
      const result = await extractPdfText(bytes, { maxChars: options.maxChars })
      return { text: result.text, pageCount: result.pageCount }
    } catch (error) {
      // PDF scan (khong co text layer) → `CONTEXT_PDF_NOT_READABLE` →
      // map sang `DOCUMENT_NOT_READABLE` cho nhanh tai lieu.
      if (error instanceof SafeFetchError && error.code === ERROR_CODES.CONTEXT_PDF_NOT_READABLE) {
        throw new SafeFetchError(
          ERROR_CODES.DOCUMENT_NOT_READABLE,
          'PDF khong co text layer (ban scan) → hay tai len anh thay the.',
          422,
        )
      }
      throw error
    }
  }

  if (kind === 'docx') {
    return { text: await extractDocxText(bytes), pageCount: undefined }
  }

  return { text: extractPlainText(bytes), pageCount: undefined }
}

/**
 * Trich xuat text tu file DOCX (OOXML) bang `mammoth`.
 *
 * Import dong de giup bundle server nho + tranh canh giua module ESM/CJS.
 *
 * @param bytes - Noi dung file docx.
 */
async function extractDocxText(bytes: Uint8Array): Promise<string> {
  try {
    // `mammoth` la CommonJS (`export =`) → dynamic import tra ve namespace,
    // phai lay qua `default`.
    const imported = (await import('mammoth')) as unknown as {
      default?: { extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }> }
    }
    const mammoth = imported.default
    if (mammoth === undefined) {
      throw new Error('Khong tim thay module mammoth')
    }

    const buffer = Buffer.from(bytes)
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    throw new SafeFetchError(
      ERROR_CODES.DOCUMENT_NOT_READABLE,
      `Khong doc duoc file DOCX: ${error instanceof Error ? error.message : String(error)}`,
      422,
    )
  }
}

/**
 * Giai ma file text thuong (txt / md / csv) — UTF-8.
 *
 * File co byte NUL → coi nhieu binary → khong doc duoc (tranh gui rac
 * thong diep vo nghia len model).
 *
 * @param bytes - Noi dung file.
 */
function extractPlainText(bytes: Uint8Array): string {
  // Nhanh bat ky: file text that khong bao gio chua byte NUL.
  for (const byte of bytes) {
    if (byte === 0) {
      throw new SafeFetchError(
        ERROR_CODES.DOCUMENT_NOT_READABLE,
        'File co du lieu binary — chi ho tro file text (TXT/MD/CSV).',
        422,
      )
    }
  }

  const decoder = new TextDecoder('utf-8', { fatal: false })
  return decoder.decode(bytes)
}

/**
 * Chuan hoa text: bo BOM, gom khoang trang thua, chuan hoa xuong dong.
 *
 * @param text - Text thô.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
