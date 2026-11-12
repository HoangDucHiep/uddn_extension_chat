import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '@sidekick/shared'
import {
  detectDocumentKind,
  extractDocumentText,
  fileExtensionOf,
  normalizeText,
} from '../src/lib/documentExtractor.js'
import { SafeFetchError } from '../src/lib/safeFetch.js'

/**
 * Unit test cho extractor tai lieu — T-M2-23 (FR-CONTEXT-14).
 *
 * Dung PDF "mini" tao tay (co text layer that) va DOCX "mini" tao tay
 * (zip + XML) — khong can file ngoai → test chay offline & deterministically.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

/**
 * Tao mot file PDF hop le voi text layer tu danh sach dong text.
 *
 * @param lines - Cac dong text se ve len trang.
 */
function buildPdf(lines: string[]): Uint8Array {
  const content = lines
    .map(
      (line, index) =>
        `BT /F1 24 Tf 72 ${720 - index * 30} Td (${line.replace(/[()\\]/g, '')}) Tj ET`,
    )
    .join('\n')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

/**
 * Tao mot file DOCX hop le (zip giong cau truc OOXML toi gian).
 *
 * Dung `fflate` khong co san → tao zip bang `jszip` (dependency cua mammoth)
 * de tranh them dependency moi cho monorepo.
 *
 * @param paragraphs - Cac doan van ban trong document.
 */
async function buildDocx(paragraphs: string[]): Promise<Uint8Array> {
  const { default: JSZip } = (await import('jszip')) as unknown as {
    default: new () => {
      file: (path: string, content: string) => unknown
      generateAsync: (options: { type: 'uint8array' }) => Promise<Uint8Array>
    }
  }

  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  )

  const body = paragraphs
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join('')
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  )

  return zip.generateAsync({ type: 'uint8array' })
}

/** Chuyen chuoi sang byte (UTF-8). */
function toBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

describe('fileExtensionOf', () => {
  it('lay duoi file (khong phan biet hoa thuong)', () => {
    expect(fileExtensionOf('bao-cao.PDF')).toBe('.pdf')
    expect(fileExtensionOf('/a/b/tai-lieu.docx')).toBe('.docx')
    expect(fileExtensionOf('C:\\docs\\ghi-chu.md')).toBe('.md')
  })

  it('tra chuoi rong khi khong co duoi ho duoi bat dau bang cham', () => {
    expect(fileExtensionOf('khong-co-duoi')).toBe('')
    expect(fileExtensionOf('.an-hidden')).toBe('')
  })
})

describe('detectDocumentKind', () => {
  it('nhan PDF qua magic byte', () => {
    expect(detectDocumentKind('khong-quan-trong.pdf', buildPdf(['x']))).toBe('pdf')
  })

  it('nhan docx qua duoi file', () => {
    expect(detectDocumentKind('tai-lieu.docx', toBytes('bat ky'))).toBe('docx')
  })

  it('nhan txt / md / csv la text', () => {
    expect(detectDocumentKind('a.txt', toBytes('x'))).toBe('text')
    expect(detectDocumentKind('a.md', toBytes('x'))).toBe('text')
    expect(detectDocumentKind('a.csv', toBytes('x'))).toBe('text')
  })

  it('tra undefined cho dinh dang khong ho tro', () => {
    expect(detectDocumentKind('a.xlsx', toBytes('x'))).toBeUndefined()
    expect(detectDocumentKind('a.doc', toBytes('x'))).toBeUndefined()
    expect(detectDocumentKind('a.exe', toBytes('x'))).toBeUndefined()
  })
})

describe('normalizeText', () => {
  it('bo BOM + chuan hoa xuong dong', () => {
    expect(normalizeText('\uFEFFline1\r\nline2')).toBe('line1\nline2')
  })

  it('gom khoang trang thua truoc xuong dong', () => {
    expect(normalizeText('a   \nb')).toBe('a\nb')
  })

  it('gom nhieu dong trong rong thanh 1 dong trong', () => {
    expect(normalizeText('a\n\n\n\nb')).toBe('a\n\nb')
  })
})

describe('extractDocumentText', () => {
  it('trich duoc text tu PDF', async () => {
    const bytes = buildPdf(['Xin chao Sidekick AI'])
    const result = await extractDocumentText(bytes, {
      fileName: 'bao-cao.pdf',
      mimeType: 'application/pdf',
      maxChars: 40_000,
      maxExcerptChars: 500,
    })

    expect(result.kind).toBe('pdf')
    expect(result.text).toContain('Xin chao Sidekick AI')
    expect(result.truncated).toBe(false)
    expect(result.pageCount).toBe(1)
  })

  it('trich duoc text tu DOCX', async () => {
    const bytes = await buildDocx(['Doan mot', 'Doan hai'])
    const result = await extractDocumentText(bytes, {
      fileName: 'tai-lieu.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      maxChars: 40_000,
      maxExcerptChars: 500,
    })

    expect(result.kind).toBe('docx')
    expect(result.text).toContain('Doan mot')
    expect(result.text).toContain('Doan hai')
  })

  it('trich duoc text tu file txt (bo BOM)', async () => {
    const bytes = toBytes('\uFEFFNoi dung tai lieu')
    const result = await extractDocumentText(bytes, {
      fileName: 'ghi-chu.txt',
      mimeType: 'text/plain',
      maxChars: 40_000,
      maxExcerptChars: 500,
    })

    expect(result.kind).toBe('text')
    expect(result.text).toBe('Noi dung tai lieu')
    expect(result.text.startsWith('\uFEFF')).toBe(false)
  })

  it('nem DOCUMENT_UNSUPPORTED_TYPE cho dinh dang la', async () => {
    await expect(
      extractDocumentText(toBytes('binary'), {
        fileName: 'file.xlsx',
        mimeType: 'application/vnd.ms-excel',
        maxChars: 40_000,
        maxExcerptChars: 500,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE })
  })

  it('nem DOCUMENT_NOT_READABLE khi file co byte NUL (binary)', async () => {
    const bytes = new Uint8Array([0x61, 0x62, 0x00, 0x63])
    await expect(
      extractDocumentText(bytes, {
        fileName: 'a.txt',
        mimeType: 'text/plain',
        maxChars: 40_000,
        maxExcerptChars: 500,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.DOCUMENT_NOT_READABLE })
  })

  it('nem DOCUMENT_EMPTY khi file rong', async () => {
    await expect(
      extractDocumentText(toBytes('   \n  '), {
        fileName: 'a.txt',
        mimeType: 'text/plain',
        maxChars: 40_000,
        maxExcerptChars: 500,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.DOCUMENT_EMPTY })
  })

  it('nem SafeFetchError voi code chuan', async () => {
    await expect(
      extractDocumentText(toBytes('x'), {
        fileName: 'a.exe',
        mimeType: '',
        maxChars: 40_000,
        maxExcerptChars: 500,
      }),
    ).rejects.toBeInstanceOf(SafeFetchError)
  })

  it('cat noi dung va danh dau truncated khi vuot gioi han', async () => {
    const result = await extractDocumentText(toBytes('a'.repeat(500)), {
      fileName: 'a.txt',
      mimeType: 'text/plain',
      maxChars: 100,
      maxExcerptChars: 20,
    })

    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(100)
    expect(result.excerpt.length).toBeLessThanOrEqual(23)
  })

  // --- Fix T-M2-23: excerpt phai <= maxExcerptChars (ke ca dau "...") ---
  it('excerpt KHONG vuot maxExcerptChars (ke ca dau ellipsis) — fix T-M2-23', async () => {
    const result = await extractDocumentText(toBytes('a'.repeat(5000)), {
      fileName: 'a.txt',
      mimeType: 'text/plain',
      maxChars: 40_000,
      maxExcerptChars: 500,
    })

    // Truoc fix: 500 + "..." = 503 > 500 → `contextItemSchema` reject →
    // `POST /api/chat` 400 → panel khong chat duoc.
    expect(result.excerpt.length).toBeLessThanOrEqual(500)
    expect(result.excerpt.endsWith('...')).toBe(true)
  })

  it('excerpt ngan hon gioi han → giu nguyen', async () => {
    const result = await extractDocumentText(toBytes('Ngan'), {
      fileName: 'a.txt',
      mimeType: 'text/plain',
      maxChars: 40_000,
      maxExcerptChars: 500,
    })

    expect(result.excerpt).toBe('Ngan')
  })
})
