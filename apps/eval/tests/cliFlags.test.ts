import { describe, expect, it } from 'vitest'
import { readBoolFlag, readFlag, readListFlag, readNumberFlag } from '../src/cliFlags.js'

/**
 * Test tien ich doc flag cua CLI eval.
 *
 * AC:
 *  - Flag co gia tri → tra dung.
 *  - Flag khong co → tra fallback.
 *  - Flag danh sach tach theo **phay hoac khoang trang** (shell bien phay
 *    thanh khoang trang khi truyen qua nhieu tang wrapper).
 */

describe('readFlag', () => {
  it('doc gia tri theo sau ten flag', () => {
    expect(readFlag(['--base-url', 'http://x'], '--base-url', 'fallback')).toBe('http://x')
  })

  it('khong co flag → tra fallback', () => {
    expect(readFlag([], '--base-url', 'fallback')).toBe('fallback')
  })

  it('flag o cuoi khong co gia tri → tra fallback', () => {
    expect(readFlag(['--base-url'], '--base-url', 'fallback')).toBe('fallback')
  })
})

describe('readNumberFlag', () => {
  it('doc so', () => {
    expect(readNumberFlag(['--runs', '5'], '--runs')).toBe(5)
  })

  it('khong co flag → undefined', () => {
    expect(readNumberFlag([], '--runs')).toBeUndefined()
  })

  it('gia tri khong phai so → undefined', () => {
    expect(readNumberFlag(['--runs', 'abc'], '--runs')).toBeUndefined()
  })
})

describe('readBoolFlag', () => {
  it('co co → true', () => {
    expect(readBoolFlag(['--dry-run'], '--dry-run')).toBe(true)
  })

  it('khong co → false', () => {
    expect(readBoolFlag([], '--dry-run')).toBe(false)
  })
})

describe('readListFlag', () => {
  it('tach theo phay', () => {
    expect(readListFlag(['--tasks', 'a,b,c'], '--tasks')).toEqual(['a', 'b', 'c'])
  })

  it('tach theo khoang trang (shell bien phay thanh khoang trang)', () => {
    expect(readListFlag(['--tasks', 'a b c'], '--tasks')).toEqual(['a', 'b', 'c'])
  })

  it('dung khi nhieu token tach nhau', () => {
    expect(readListFlag(['--tasks', 'a', 'b', '--runs', '3'], '--tasks')).toEqual(['a', 'b'])
  })

  it('khong co flag → undefined', () => {
    expect(readListFlag([], '--tasks')).toBeUndefined()
  })

  it('flag khong co gia tri → undefined', () => {
    expect(readListFlag(['--tasks'], '--tasks')).toBeUndefined()
  })
})
