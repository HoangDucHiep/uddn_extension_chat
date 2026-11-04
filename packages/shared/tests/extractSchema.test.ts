/**
 * Unit test cho contract trich xuat context (T-M1-21 / T-M1-22).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

import { describe, expect, it } from 'vitest'
import { detectPageKind, extractYouTubeVideoId, isPdfUrl } from '../src/pageKind.js'
import {
  extractRequestSchema,
  extractResponseSchema,
  pageKindSchema,
} from '../src/schemas/extract.js'
import { ERROR_CODES } from '../src/errors.js'

describe('detectPageKind', () => {
  it('nhan trang HTML thuong', () => {
    expect(detectPageKind('https://example.com/bai-viet')).toBe('html')
    expect(detectPageKind('http://example.com')).toBe('html')
  })

  it('nhan file PDF theo duoi duong dan', () => {
    expect(detectPageKind('https://example.com/tai-lieu.pdf')).toBe('pdf')
    expect(detectPageKind('https://example.com/BAI-VIET.PDF')).toBe('pdf')
  })

  it('nhan URL YouTube o nhieu hinh thuc', () => {
    expect(detectPageKind('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
    expect(detectPageKind('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
    expect(detectPageKind('https://www.youtube.com/shorts/abc123')).toBe('youtube')
    expect(detectPageKind('https://www.youtube.com/live/abc123')).toBe('youtube')
    expect(detectPageKind('https://www.youtube.com/embed/abc123')).toBe('youtube')
  })

  it('tra unknown cho trang dac biet hoac URL hong', () => {
    expect(detectPageKind('chrome://extensions')).toBe('unknown')
    expect(detectPageKind('chrome-extension://abc/page.html')).toBe('unknown')
    expect(detectPageKind('file:///C:/a.pdf')).toBe('unknown')
    expect(detectPageKind('not-a-url')).toBe('unknown')
    expect(detectPageKind('')).toBe('unknown')
  })
})

describe('extractYouTubeVideoId', () => {
  it('lay video id tu watch/shorts/embed/youtu.be', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('tra undefined cho host khong phai YouTube', () => {
    expect(extractYouTubeVideoId('https://example.com/watch?v=abc')).toBeUndefined()
    expect(extractYouTubeVideoId('https://vimeo.com/12345')).toBeUndefined()
    expect(extractYouTubeVideoId('https://www.youtube.com/')).toBeUndefined()
  })
})

describe('isPdfUrl', () => {
  it('chi nhan http(s) ket thuc bang .pdf', () => {
    expect(isPdfUrl('https://example.com/a.pdf')).toBe(true)
    expect(isPdfUrl('https://example.com/a.pdf?download=1')).toBe(true)
    expect(isPdfUrl('https://example.com/a.html')).toBe(false)
    expect(isPdfUrl('file:///C:/a.pdf')).toBe(false)
    expect(isPdfUrl('nonsense')).toBe(false)
  })
})

describe('pageKindSchema', () => {
  it('accept 4 loai page kind', () => {
    for (const kind of ['html', 'pdf', 'youtube', 'unknown']) {
      expect(pageKindSchema.safeParse(kind).success).toBe(true)
    }
  })

  it('reject loai khong dung', () => {
    expect(pageKindSchema.safeParse('docx').success).toBe(false)
  })
})

describe('extractRequestSchema', () => {
  it('accept kind pdf voi url hop le', () => {
    const parsed = extractRequestSchema.safeParse({
      kind: 'pdf',
      url: 'https://example.com/a.pdf',
    })
    expect(parsed.success).toBe(true)
  })

  it('accept kind youtube voi url hop le', () => {
    const parsed = extractRequestSchema.safeParse({
      kind: 'youtube',
      url: 'https://www.youtube.com/watch?v=abc',
    })
    expect(parsed.success).toBe(true)
  })

  it('reject kind html (chi BFF trich xuat pdf/youtube)', () => {
    const parsed = extractRequestSchema.safeParse({
      kind: 'html',
      url: 'https://example.com',
    })
    expect(parsed.success).toBe(false)
  })

  it('reject url khong hop le', () => {
    const parsed = extractRequestSchema.safeParse({ kind: 'pdf', url: 'not-a-url' })
    expect(parsed.success).toBe(false)
  })
})

describe('extractResponseSchema', () => {
  it('accept response thanh cong', () => {
    const parsed = extractResponseSchema.safeParse({
      kind: 'pdf',
      text: 'Noi dung PDF',
      truncated: false,
    })
    expect(parsed.success).toBe(true)
  })

  it('accept response co error code chuan', () => {
    const parsed = extractResponseSchema.safeParse({
      kind: 'pdf',
      text: '',
      truncated: false,
      error: ERROR_CODES.CONTEXT_PDF_NOT_READABLE,
      errorMessage: 'PDF khong co text layer',
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.error).toBe('CONTEXT_PDF_NOT_READABLE')
    }
  })

  it('reject error code ngoai danh sach', () => {
    const parsed = extractResponseSchema.safeParse({
      kind: 'pdf',
      text: '',
      truncated: false,
      error: 'BOOM',
    })
    expect(parsed.success).toBe(false)
  })
})
