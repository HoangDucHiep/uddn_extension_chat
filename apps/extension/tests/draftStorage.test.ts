import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDraft,
  DRAFT_STORAGE_PREFIX,
  DRAFT_TTL_MS,
  draftKey,
  readDraft,
  writeDraft,
} from '../src/lib/storage'

/**
 * Lay noi dung raw tu `chrome.storage.local` (bypass logic readDraft).
 *
 * @param key - Khoa can doc.
 */
async function rawGet(key: string): Promise<unknown> {
  const stored = await chrome.storage.local.get(key)
  return stored[key]
}

describe('draftStorage', () => {
  beforeEach(async () => {
    // Mock `chrome.storage.local` khong co `clear()` → xoa tung khoa.
    await chrome.storage.local.remove([
      draftKey('conv-1'),
      draftKey('conv-2'),
    ])
  })

  it('tao khoa theo conversationId', () => {
    expect(draftKey('abc')).toBe(`${DRAFT_STORAGE_PREFIX}abc`)
  })

  it('luu va khoi phuc ban nhap', async () => {
    await writeDraft('conv-1', 'noi dung ban nhap')

    expect(await readDraft('conv-1')).toBe('noi dung ban nhap')
  })

  it('khoa khac conversation khong bi doc nham', async () => {
    await writeDraft('conv-1', 'a')
    await writeDraft('conv-2', 'b')

    expect(await readDraft('conv-1')).toBe('a')
    expect(await readDraft('conv-2')).toBe('b')
  })

  it('xoa ban nhap', async () => {
    await writeDraft('conv-1', 'a')
    await clearDraft('conv-1')

    expect(await readDraft('conv-1')).toBeUndefined()
    expect(await rawGet(draftKey('conv-1'))).toBeUndefined()
  })

  it('noi dung rong → khong luu', async () => {
    await writeDraft('conv-1', '')

    expect(await rawGet(draftKey('conv-1'))).toBeUndefined()
  })

  it('ban nhap qua TTL → tra undefined va xoa khoa', async () => {
    await writeDraft('conv-1', 'cu')

    const future = Date.now() + DRAFT_TTL_MS + 1_000
    expect(await readDraft('conv-1', future)).toBeUndefined()
    expect(await rawGet(draftKey('conv-1'))).toBeUndefined()
  })

  it('chuoi rong (format client cu) → tra undefined', async () => {
    await chrome.storage.local.set({ [draftKey('conv-1')]: '' })

    expect(await readDraft('conv-1')).toBeUndefined()
  })

  it('gia tri khong phai object → tra undefined', async () => {
    await chrome.storage.local.set({ [draftKey('conv-1')]: 42 })

    expect(await readDraft('conv-1')).toBeUndefined()
  })
})
