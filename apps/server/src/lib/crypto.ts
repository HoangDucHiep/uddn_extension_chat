/**
 * Ma hoa AES-256-GCM cho BYOK key (K2).
 *
 * MASTER_KEY la 32 byte hex (64 ky tu) tu bien moi truong — KHONG commit.
 * moi key duoc luu: ciphertext + iv + auth_tag (base64).
 * Docs: docs/SYSTEM_DESIGN.md §6.1
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16

export interface EncryptedPayload {
  ciphertext: string
  iv: string
  authTag: string
}

/** Chuyen hex string (64 ky tu) thanh Buffer 32 byte. */
export function hexToKey(hex: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('MASTER_KEY phai la hex 64 ky tu (32 byte)')
  }
  return Buffer.from(hex, 'hex')
}

/** Tao payload ngau nhien — dung cho IV + auth tag mac dinh. */
export function createEncryptedPayload(): EncryptedPayload {
  return {
    ciphertext: '',
    iv: randomBytes(IV_LENGTH_BYTES).toString('base64'),
    authTag: randomBytes(AUTH_TAG_LENGTH_BYTES).toString('base64'),
  }
}

/**
 * Ma hoa mot chuoi nho voi AES-256-GCM.
 * IV moi cho moi lan ma hoa — bat buoc, khong bao gio tai su dung.
 */
export function encrypt(plaintext: string, masterKeyHex: string): EncryptedPayload {
  const key = hexToKey(masterKeyHex)
  const iv = randomBytes(IV_LENGTH_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

/**
 * Giai ma payload. Nem loi neu ciphertext bi sua doi (auth tag khong khop).
 */
export function decrypt(payload: EncryptedPayload, masterKeyHex: string): string {
  const key = hexToKey(masterKeyHex)
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ])

  return plaintext.toString('utf8')
}

/**
 * 4 ky tu cuoi cua key de user nhan ra key nao la key nao.
 * Khong du de su dung key.
 */
export function keyHint(apiKey: string): string {
  return apiKey.slice(-4)
}
