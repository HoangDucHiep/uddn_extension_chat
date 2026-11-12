import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { API_BASE_PATH, DOCUMENT, ERROR_CODES } from '@sidekick/shared'
import { createExtractRouter } from '../src/routes/extract.js'

/**
 * Unit test cho route trich xuat context.
 *
 * Nguyen tac quan trong: loi nghiep vu (PDF scan, khong co caption) phai tra
 * HTTP 200 kem `error` trong body — client khong phan biet theo status.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1
 */

/** Server Express thật de test qua HTTP that (khong mock router). */
let server: Server
let baseUrl: string

beforeAll(async () => {
  const app = express()
  // Limit lon hon mac dinh 100kb — tai lieu co the toi 8 MB (base64 ~10.7 MB).
  app.use(express.json({ limit: '16mb' }))
  app.use(API_BASE_PATH, createExtractRouter())

  server = await new Promise<Server>((resolve) => {
    const created = app.listen(0, () => resolve(created))
  })

  const address = server.address() as AddressInfo
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Tao mot file PDF hop le voi text layer tu danh sach dong text.
 *
 * Dung khi test duong upload tai lieu that (base64 → server decode) — PDF
 * "mini" co text layer that, khong can file ngoai.
 *
 * @param lines - Cac dong text se ve len trang.
 */
function buildPdf(lines: string[]): Buffer {
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

  return Buffer.from(pdf, 'utf-8')
}

/**
 * Tao mot file DOCX hop le (zip giong cau truc OOXML toi gian) → base64.
 *
 * Dung `jszip` (dependency cua mammoth) de tranh them dependency moi.
 *
 * @param paragraphs - Cac doan van ban trong document.
 * @returns Noi dung file DOCX dang base64 thuan.
 */
async function buildDocxBase64(paragraphs: string[]): Promise<string> {
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

  const bytes = await zip.generateAsync({ type: 'uint8array' })
  return Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength).toString(
    'base64',
  )
}

describe('POST /api/extract/pdf', () => {
  it('tra 400 khi body sai schema', async () => {
    const response = await fetch(`${baseUrl}/api/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'html', url: 'https://example.com' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('tra 400 khi url khong hop le', async () => {
    const response = await fetch(`${baseUrl}/api/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pdf', url: 'khong-phai-url' }),
    })

    expect(response.status).toBe(400)
  })

  it('tra 200 + error code khi khong fetch duoc PDF (SSRF chan)', async () => {
    // `127.0.0.1` bi `safeFetch` chan → loi nghiep vu, phai ra HTTP 200.
    const response = await fetch(`${baseUrl}/api/extract/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pdf', url: 'http://127.0.0.1:9/a.pdf' }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; text: string; error?: string }
    expect(body.kind).toBe('pdf')
    expect(body.text).toBe('')
    expect(body.error).toBe(ERROR_CODES.CONTEXT_PDF_UNREACHABLE)
  })
})

describe('POST /api/extract/youtube', () => {
  it('tra 400 khi body sai schema', async () => {
    const response = await fetch(`${baseUrl}/api/extract/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'pdf', url: 'https://www.youtube.com/watch?v=abc' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('tra 200 + error code khi khong lay duoc transcript', async () => {
    // Host khong ton tai → loi nghiep vu → van HTTP 200.
    const response = await fetch(`${baseUrl}/api/extract/youtube`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'youtube',
        url: 'https://this-host-does-not-exist-sidekick-test.invalid/watch?v=abc',
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { kind: string; text: string; error?: string }
    expect(body.kind).toBe('youtube')
    expect(body.error).toBe(ERROR_CODES.CONTEXT_TRANSCRIPT_UNAVAILABLE)
  })
})

describe('POST /api/extract/document', () => {
  it('tra 400 khi body sai schema', async () => {
    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'a.txt' }),
    })

    expect(response.status).toBe(400)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('tra 200 + text khi file txt hop le', async () => {
    const data = Buffer.from('Noi dung tai lieu thu nghiem', 'utf-8').toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'ghi-chu.txt', mimeType: 'text/plain', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      kind: string
      text: string
      title?: string
      excerpt?: string
      truncated: boolean
      error?: string
    }
    expect(body.kind).toBe('text')
    expect(body.text).toBe('Noi dung tai lieu thu nghiem')
    expect(body.title).toBe('ghi-chu.txt')
    expect(body.truncated).toBe(false)
    expect(body.error).toBeUndefined()
  })

  it('tra 200 + error code khi dinh dang khong ho tro', async () => {
    const data = Buffer.from('binary', 'utf-8').toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'file.xlsx', mimeType: 'application/vnd.ms-excel', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { text: string; error?: string }
    expect(body.text).toBe('')
    expect(body.error).toBe(ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE)
  })

  it('tra 200 + error code khi file rong', async () => {
    const data = Buffer.from('   ', 'utf-8').toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'rong.txt', mimeType: 'text/plain', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { text: string; error?: string }
    expect(body.error).toBe(ERROR_CODES.DOCUMENT_EMPTY)
  })

  it('tra 413 khi file vuot gioi han kich thuoc', async () => {
    // 8 MB file → base64 ~10.7 MB → byte thuc > `DOCUMENT.MAX_BYTES`.
    const data = Buffer.alloc(DOCUMENT.MAX_BYTES + 1, 0x61).toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'lon.txt', mimeType: 'text/plain', data }),
    })

    expect(response.status).toBe(413)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE)
  })

  // Regression (T-M2-23): duong upload that se giai ma base64 ra `Buffer`.
  // `pdfjs-dist` (node build) tu choi `Buffer` → PDF bi loi "Please provide
  // binary data as `Uint8Array`, rather than `Buffer`." Kiem tra ca endpoint
  // (khong chi unit test) de chan regression o bien HTTP.
  it('tra 200 + text khi file PDF hop le (duong upload that)', async () => {
    const data = buildPdf(['Xin chao tu file PDF']).toString('base64')

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: 'sach.pdf', mimeType: 'application/pdf', data }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      kind: string
      text: string
      truncated: boolean
      error?: string
      errorMessage?: string
    }
    expect(body.error).toBeUndefined()
    expect(body.kind).toBe('pdf')
    expect(body.text).toContain('Xin chao tu file PDF')
    expect(body.truncated).toBe(false)
  })

  it('tra 200 + text khi file DOCX hop le (duong upload that)', async () => {
    const data = await buildDocxBase64(['Doan van ban thu nhat', 'Doan van ban thu hai'])

    const response = await fetch(`${baseUrl}/api/extract/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'tai-lieu.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data,
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      kind: string
      text: string
      error?: string
    }
    expect(body.error).toBeUndefined()
    expect(body.kind).toBe('docx')
    expect(body.text).toContain('Doan van ban thu nhat')
    expect(body.text).toContain('Doan van ban thu hai')
  })
})
