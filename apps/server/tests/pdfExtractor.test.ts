import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '@sidekick/shared'
import { extractPdfText, joinTextItems } from '../src/lib/pdfExtractor.js'
import { SafeFetchError } from '../src/lib/safeFetch.js'

/**
 * Unit test cho PDF extractor — T-M1-21.
 *
 * Dung PDF "mini" tao tay (co text layer that) va PDF rong (tuong duong PDF
 * scan) — khong can file ngoai → test chay offline & deterministically.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

/**
 * Tao mot file PDF hop le voi text layer tu danh sach dong text.
 *
 * Luu y: moi dong toi da 46 ky tu — text vuot qua be rong trang se bi pdfjs
 * cat (giu nguyen hanh cua PDF renderer). Test can nhieu dong de du do dai.
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

describe('joinTextItems', () => {
  it('ghep item cung dong bang khoang trang', () => {
    const text = joinTextItems([
      { str: 'Hello', transform: [1, 0, 0, 1, 10, 100] },
      { str: 'World', transform: [1, 0, 0, 1, 60, 100] },
    ])
    expect(text).toBe('Hello World')
  })

  it('tach dong khi Y khac nhau', () => {
    const text = joinTextItems([
      { str: 'Dong 1', transform: [1, 0, 0, 1, 10, 100] },
      { str: 'Dong 2', transform: [1, 0, 0, 1, 10, 70] },
    ])
    expect(text).toBe('Dong 1\nDong 2')
  })
})

describe('extractPdfText', () => {
  it('trich duoc text tu PDF co text layer', async () => {
    const bytes = buildPdf(['Xin chao Sidekick AI', 'Dong thu hai'])
    const result = await extractPdfText(bytes)

    expect(result.pageCount).toBe(1)
    expect(result.truncated).toBe(false)
    expect(result.text).toContain('Xin chao Sidekick AI')
    expect(result.text).toContain('Dong thu hai')
  })

  it('nem CONTEXT_PDF_NOT_READABLE khi PDF khong co text layer (PDF scan)', async () => {
    const bytes = buildPdf([])
    await expect(extractPdfText(bytes)).rejects.toBeInstanceOf(SafeFetchError)

    await expect(extractPdfText(bytes)).rejects.toMatchObject({
      code: ERROR_CODES.CONTEXT_PDF_NOT_READABLE,
    })
  })

  it('cat noi dung khi vuot gioi han do dai', async () => {
    const bytes = buildPdf([`${'x'.repeat(40)}`, `${'y'.repeat(40)}`])
    const result = await extractPdfText(bytes, { maxChars: 50 })

    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(50)
  })
})
