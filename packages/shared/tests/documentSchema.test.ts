import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_ERROR_CODES,
  DOCUMENT_KINDS,
  documentExtractRequestSchema,
  documentExtractResponseSchema,
} from '../src/schemas/document.js'
import { ERROR_CODES } from '../src/errors.js'

/**
 * Unit test cho contract trich xuat tai lieu — T-M2-23 (FR-CONTEXT-14).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.29
 */

describe('documentExtractRequestSchema', () => {
  it('accept body hop le', () => {
    const parsed = documentExtractRequestSchema.safeParse({
      fileName: 'bao-cao.pdf',
      mimeType: 'application/pdf',
      data: 'JVBERi0=',
    })

    expect(parsed.success).toBe(true)
  })

  it('reject khi thieu fileName', () => {
    const parsed = documentExtractRequestSchema.safeParse({
      mimeType: 'text/plain',
      data: 'abc',
    })

    expect(parsed.success).toBe(false)
  })

  it('reject khi fileName qua dai', () => {
    const parsed = documentExtractRequestSchema.safeParse({
      fileName: 'a'.repeat(256),
      mimeType: 'text/plain',
      data: 'abc',
    })

    expect(parsed.success).toBe(false)
  })

  it('reject khi data rong', () => {
    const parsed = documentExtractRequestSchema.safeParse({
      fileName: 'a.txt',
      mimeType: 'text/plain',
      data: '',
    })

    expect(parsed.success).toBe(false)
  })

  it('accept mimeType rong (trinh duiet khong cung cap)', () => {
    const parsed = documentExtractRequestSchema.safeParse({
      fileName: 'a.txt',
      mimeType: '',
      data: 'abc',
    })

    expect(parsed.success).toBe(true)
  })
})

describe('documentExtractResponseSchema', () => {
  it('accept response thanh cong', () => {
    const parsed = documentExtractResponseSchema.safeParse({
      kind: 'text',
      text: 'noi dung',
      title: 'a.txt',
      excerpt: 'noi dung',
      truncated: false,
    })

    expect(parsed.success).toBe(true)
  })

  it('accept response loi nghiep vu (HTTP 200 + error)', () => {
    const parsed = documentExtractResponseSchema.safeParse({
      kind: 'text',
      text: '',
      truncated: false,
      error: DOCUMENT_ERROR_CODES.DOCUMENT_NOT_READABLE,
      errorMessage: 'file hong',
    })

    expect(parsed.success).toBe(true)
  })

  it('reject kind khong hop le', () => {
    const parsed = documentExtractResponseSchema.safeParse({
      kind: 'xlsx',
      text: '',
      truncated: false,
    })

    expect(parsed.success).toBe(false)
  })

  it('reject error code khong thuoc danh sach', () => {
    const parsed = documentExtractResponseSchema.safeParse({
      kind: 'text',
      text: '',
      truncated: false,
      error: 'KHONG_CO_CODE_NAY',
    })

    expect(parsed.success).toBe(false)
  })
})

describe('DOCUMENT_KINDS', () => {
  it('co du 3 loai tai lieu', () => {
    expect(DOCUMENT_KINDS).toEqual(['pdf', 'docx', 'text'])
  })
})

describe('DOCUMENT_ERROR_CODES', () => {
  it('map ve ERROR_CODES chuan', () => {
    expect(DOCUMENT_ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE).toBe(
      ERROR_CODES.DOCUMENT_UNSUPPORTED_TYPE,
    )
    expect(DOCUMENT_ERROR_CODES.DOCUMENT_TOO_LARGE).toBe(ERROR_CODES.DOCUMENT_TOO_LARGE)
    expect(DOCUMENT_ERROR_CODES.DOCUMENT_NOT_READABLE).toBe(ERROR_CODES.DOCUMENT_NOT_READABLE)
    expect(DOCUMENT_ERROR_CODES.DOCUMENT_EMPTY).toBe(ERROR_CODES.DOCUMENT_EMPTY)
  })
})
