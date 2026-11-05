import { describe, expect, it } from 'vitest'
import { buildOpenAiContent } from '../src/providers/openaiCompatible.js'

/**
 * Test helper dung payload OpenAI-compatible (FR-VISION-01 — T-M1-24).
 */

describe('buildOpenAiContent', () => {
  it('khong co anh → tra chuoi text thuan', () => {
    expect(buildOpenAiContent('Xin chao', undefined)).toBe('Xin chao')
    expect(buildOpenAiContent('Xin chao', [])).toBe('Xin chao')
  })

  it('co anh → tra mang parts', () => {
    const content = buildOpenAiContent('Mo ta', [
      { mimeType: 'image/png', data: 'aGVsbG8=' },
    ])

    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) return

    expect(content[0]).toEqual({ type: 'text', text: 'Mo ta' })
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,aGVsbG8=' },
    })
  })

  it('nhieu anh → nhieu part image_url theo thu tu', () => {
    const content = buildOpenAiContent('X', [
      { mimeType: 'image/png', data: 'AAAA' },
      { mimeType: 'image/jpeg', data: 'BBBB' },
    ])

    expect(Array.isArray(content)).toBe(true)
    if (!Array.isArray(content)) return

    expect(content).toHaveLength(3)
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAAA' },
    })
    expect(content[2]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,BBBB' },
    })
  })
})
