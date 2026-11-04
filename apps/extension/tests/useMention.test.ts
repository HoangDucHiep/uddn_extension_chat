import { describe, expect, it } from 'vitest'
import { findMention } from '../src/sidepanel/hooks/useMention.js'

/**
 * Unit test cho logic phat hien token `@` (T-M1-05).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3
 */

describe('findMention', () => {
  it('bat token @ o dau chuoi', () => {
    const match = findMention('@bai', 4)

    expect(match).toBeDefined()
    expect(match?.query).toBe('bai')
    expect(match?.start).toBe(0)
    expect(match?.end).toBe(4)
  })

  it('bat token @ sau khoang trang', () => {
    const value = 'so sanh @tab'
    const match = findMention(value, value.length)

    expect(match?.query).toBe('tab')
    expect(match?.start).toBe(8)
    expect(match?.end).toBe(12)
  })

  it('bat token @ rong (vua go xong dau @)', () => {
    const match = findMention('@', 1)

    expect(match?.query).toBe('')
    expect(match?.start).toBe(0)
  })

  it('KHONG bat @ nam giua email', () => {
    const value = 'gửi cho a@b.com'
    const match = findMention(value, value.length)

    expect(match).toBeUndefined()
  })

  it('KHONG bat @ dinh ngay sau ky tu khong phai khoang trang', () => {
    const value = 'abc@def'
    const match = findMention(value, value.length)

    expect(match).toBeUndefined()
  })

  it('KHONG bat khi con tro nam truoc token @', () => {
    // Con tro dang o dau chuoi, token `@` o sau → khong phai token dang ghep.
    const match = findMention('@abc', 0)

    expect(match).toBeUndefined()
  })

  it('KHONG bat khi khong co @ trong phan truoc con tro', () => {
    const match = findMention('xin chao', 8)

    expect(match).toBeUndefined()
  })

  it('KHONG bat khi con tro vuot do dai chuoi', () => {
    expect(findMention('@abc', 99)).toBeUndefined()
  })

  it('KHONG bat khi con tro am', () => {
    expect(findMention('@abc', -1)).toBeUndefined()
  })

  it('chi bat token moi nhat (nhieu @ trong cung 1 chuoi)', () => {
    const value = '@a @b'
    const match = findMention(value, value.length)

    expect(match?.query).toBe('b')
    expect(match?.start).toBe(3)
  })

  it('token khong chua khoang trang', () => {
    const value = '@bai viet'
    // Con tro o giua "bai" → token chi gom "bai".
    const match = findMention(value, 4)

    expect(match?.query).toBe('bai')
  })
})
