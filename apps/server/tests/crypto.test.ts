import { describe, expect, it } from 'vitest'
import {
  decrypt,
  encrypt,
  hexToKey,
  keyHint,
} from '../src/lib/crypto.js'

const MASTER_KEY = 'a'.repeat(64)

describe('crypto', () => {
  describe('hexToKey', () => {
    it('chuyen hex 64 ky tu thanh Buffer 32 byte', () => {
      expect(hexToKey(MASTER_KEY)).toHaveLength(32)
    })

    it('nem loi khi hex sai do dai', () => {
      expect(() => hexToKey('abc')).toThrow(/64/)
    })

    it('nem loi khi hex chua ky tu khong hop le', () => {
      expect(() => hexToKey('z'.repeat(64))).toThrow(/64/)
    })
  })

  describe('encrypt / decrypt', () => {
    it('giai ma duoc chuoi da ma hoa', () => {
      const payload = encrypt('gsk_secret_key', MASTER_KEY)
      expect(decrypt(payload, MASTER_KEY)).toBe('gsk_secret_key')
    })

    it('tao IV moi cho moi lan ma hoa', () => {
      const first = encrypt('abc', MASTER_KEY)
      const second = encrypt('abc', MASTER_KEY)
      expect(first.iv).not.toBe(second.iv)
      expect(first.ciphertext).not.toBe(second.ciphertext)
    })

    it('nem loi khi ciphertext bi sua doi', () => {
      const payload = encrypt('secret', MASTER_KEY)
      const tampered = {
        ...payload,
        ciphertext: Buffer.from('tampered').toString('base64'),
      }
      expect(() => decrypt(tampered, MASTER_KEY)).toThrow()
    })

    it('nem loi khi dung sai MASTER_KEY', () => {
      const payload = encrypt('secret', MASTER_KEY)
      expect(() => decrypt(payload, 'b'.repeat(64))).toThrow()
    })

    it('chu doi empty string van giai ma duoc', () => {
      const payload = encrypt('', MASTER_KEY)
      expect(decrypt(payload, MASTER_KEY)).toBe('')
    })

    it('chu doi ky tu unicode', () => {
      const payload = encrypt('Xin chÃ o ðŸš€', MASTER_KEY)
      expect(decrypt(payload, MASTER_KEY)).toBe('Xin chÃ o ðŸš€')
    })
  })

  describe('keyHint', () => {
    it('lay 4 ky tu cuoi', () => {
      expect(keyHint('gsk_abcd1234')).toBe('1234')
    })

    it('key ngan hon 4 ky tu tra ve chinh no', () => {
      expect(keyHint('ab')).toBe('ab')
    })
  })
})
