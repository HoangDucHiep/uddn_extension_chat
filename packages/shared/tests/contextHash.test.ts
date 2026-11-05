import { describe, expect, it } from 'vitest'
import { contextHashKey, hashContextItems, hashString } from '../src/contextHash.js'

/**
 * Test cho ham hash context (T-M1-06).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.5
 */

const item = {
  id: 'tab-1',
  kind: 'tab' as const,
  tier: 'attachment' as const,
  url: 'https://example.com/bai-viet',
  title: 'Bai viet',
  text: 'Noi dung chinh.',
}

describe('hashString', () => {
  it('cung noi dung → cung hash', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
  })

  it('noi dung khac → hash khac', () => {
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })

  it('hash co do dai cu dinh (hex 8 ky tu)', () => {
    expect(hashString('')).toHaveLength(8)
    expect(hashString('a'.repeat(1000))).toHaveLength(8)
  })
})

describe('hashContextItems', () => {
  it('danh sach rong → chuoi rong', () => {
    expect(hashContextItems([])).toBe('')
  })

  it('cung danh sach → cung hash', () => {
    expect(hashContextItems([item])).toBe(hashContextItems([item]))
  })

  it('thu tu item khac → CUNG hash (da sort theo tier roi id)', () => {
    const selection = {
      id: 'sel-1',
      kind: 'selection' as const,
      tier: 'selection' as const,
      title: 'Doan boi den',
      text: 'Doan da boi den.',
    }

    const forward = hashContextItems([selection, item])
    const backward = hashContextItems([item, selection])

    expect(forward).toBe(backward)
  })

  it('noi dung text khac → hash khac', () => {
    const other = { ...item, text: 'Noi dung khac.' }
    expect(hashContextItems([item])).not.toBe(hashContextItems([other]))
  })

  it('tier khac → hash khac', () => {
    const other = { ...item, tier: 'currentTab' as const }
    expect(hashContextItems([item])).not.toBe(hashContextItems([other]))
  })

  it('url khac → hash khac', () => {
    const other = { ...item, url: 'https://example.com/bai-viet-2' }
    expect(hashContextItems([item])).not.toBe(hashContextItems([other]))
  })

  it('them item → hash khac', () => {
    const second = { ...item, id: 'tab-2' }
    expect(hashContextItems([item])).not.toBe(hashContextItems([item, second]))
  })

  it('truong thuoc tinh ngan sach (khong duoc hash) khong doi hash', () => {
    // `truncated` / `tokens` la thuoc tinh ngan sach → khong anh huong noi
    // dung da gui → hash phai giong nhau.
    const withBudgetFields = { ...item, truncated: true, tokens: 42 } as unknown as typeof item

    expect(hashContextItems([withBudgetFields])).toBe(hashContextItems([item]))
  })
})

describe('contextHashKey', () => {
  it('bo fragment → cung khoa', () => {
    expect(contextHashKey('https://example.com/a#phan-1')).toBe(
      contextHashKey('https://example.com/a'),
    )
  })

  it('bo query → cung khoa', () => {
    expect(contextHashKey('https://example.com/a?x=1&y=2')).toBe(
      contextHashKey('https://example.com/a'),
    )
  })

  it('host lower-case → cung khoa', () => {
    expect(contextHashKey('https://Example.COM/a')).toBe(contextHashKey('https://example.com/a'))
  })

  it('duong dan khac → khoa khac', () => {
    expect(contextHashKey('https://example.com/a')).not.toBe(
      contextHashKey('https://example.com/b'),
    )
  })

  it('chuoi rong → khoa rong', () => {
    expect(contextHashKey('  ')).toBe('')
  })

  it('URL khong parse duoc → tra nguyen chuoi da trim', () => {
    expect(contextHashKey('  not-a-url  ')).toBe('not-a-url')
  })
})
