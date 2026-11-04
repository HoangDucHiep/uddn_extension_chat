/**
 * Trich xuat text tu file PDF — T-M1-21.
 *
 * Chrome's PDF viewer la mot browser extension (`chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/`)
 * → content script khong chay duoc → phai parse o server.
 *
 * Dung `pdfjs-dist` (build legacy) de:
 *  - Doc tung trang, gom text item theo toa do Y de giu newline.
 *  - Phat hien PDF scan (khong co text layer) → tra loi `CONTEXT_PDF_NOT_READABLE`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

import { createRequire } from 'node:module'
import { ERROR_CODES } from '@sidekick/shared'
import { SafeFetchError } from './safeFetch.js'

export interface PdfExtractionResult {
  /** Text cua file PDF (da cat theo gioi han do dai). */
  text: string
  /** So trang cua PDF. */
  pageCount: number
  /** Da cat bot vi qua gioi han do dai. */
  truncated: boolean
}

/** Mot item text cua pdfjs. */
interface PdfTextItem {
  str: string
  transform: number[]
}

/**
 * Parse PDF tu bytes → text.
 *
 * @param bytes - Noi dung file PDF.
 * @param options - Tuy chon (gioi han do dai).
 */
export async function extractPdfText(
  bytes: Uint8Array,
  options: { maxChars?: number } = {},
): Promise<PdfExtractionResult> {
  const maxChars = options.maxChars ?? Number.POSITIVE_INFINITY

  // Import dong de giup bundle server nho + tranh canh giua module ESM/CJS.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  const loadingTask = pdfjs.getDocument({
    // `Uint8Array` bi pdfjs chuyen thanh `ArrayBuffer` — phai truyền bản sao
    // riêng vì buffer goc co the bi detach sau khi doc stream.
    data: bytes.slice(),
    // Khong can render: chi lay text layer.
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: false,
    // PDF dung font chuan non-embedded (Helvetica, Times...) can bo font nay
    // de pdfjs giai ma chu sai.
    standardFontDataUrl: resolveStandardFontDataUrl(),
  })

  const doc = await loadingTask.promise

  try {
    const pageTexts: string[] = []
    let totalChars = 0
    let truncated = false

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      page.cleanup()

      const pageText = joinTextItems(content.items as PdfTextItem[])
      if (pageText.length === 0) continue

      pageTexts.push(pageText)
      totalChars += pageText.length + 1

      if (totalChars >= maxChars) {
        truncated = true
        break
      }
    }

    const text = pageTexts.join('\n\n').trim()

    // PDF scan: khong co text layer nao → khong trich duoc gi.
    if (text.length === 0) {
      throw new SafeFetchError(
        ERROR_CODES.CONTEXT_PDF_NOT_READABLE,
        'PDF khong co text layer (ban scan) → can OCR hoac tai len anh',
        422,
      )
    }

    const limited = truncated ? text.slice(0, maxChars) : text

    return {
      text: limited,
      pageCount: doc.numPages,
      truncated,
    }
  } finally {
    await doc.destroy()
  }
}

/**
 * Dia chi thu muc `standard_fonts/` cua `pdfjs-dist` (dung cho PDF chua embed font).
 *
 * Resolve 1 lan roi cache — `pdfjs` yeu cau URL bat dau bang `/` hoac `http`.
 */
let cachedFontDataUrl: string | undefined

function resolveStandardFontDataUrl(): string | undefined {
  if (cachedFontDataUrl !== undefined) return cachedFontDataUrl

  try {
    const require = createRequire(import.meta.url)
    const packageJsonPath = require.resolve('pdfjs-dist/package.json')
    cachedFontDataUrl = packageJsonPath.replace(/package\.json$/, 'standard_fonts/')
  } catch {
    cachedFontDataUrl = undefined
  }

  return cachedFontDataUrl
}

/**
 * Ghep cac text item thanh text cua trang, giu newline theo toa do Y.
 *
 * pdfjs tra item theo thu tu doc; item cung `transform[5]` (Y) la cung dong.
 */
export function joinTextItems(items: PdfTextItem[]): string {
  let output = ''
  let lastY: number | undefined
  let lastX: number | undefined

  for (const item of items) {
    if (typeof item.str !== 'string') continue

    const y = item.transform?.[5]
    const x = item.transform?.[4]

    if (lastY !== undefined && typeof y === 'number') {
      if (Math.abs(y - lastY) > 1.5) {
        // Dong moi.
        output += '\n'
      } else if (typeof x === 'number' && typeof lastX === 'number' && x - lastX > 1) {
        // Cung dong nhung cach xa → them khoang trang.
        output += ' '
      }
    }

    output += item.str
    lastY = typeof y === 'number' ? y : lastY
    lastX = typeof x === 'number' ? x : lastX
  }

  return output.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
