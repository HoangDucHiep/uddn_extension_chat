import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteLocalSidekickData } from '../src/lib/settings'

const fetchJsonMock = vi.fn()

vi.mock('@/lib/apiClient', () => ({
  fetchJson: (path: string, init?: RequestInit) => fetchJsonMock(path, init),
}))

/**
 * Unit test cho phan xoa du lieu (FR-SETTINGS-03/07 + NFR-SEC-07 — T-M1-12).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

/** Xoa het storage giữa cac test. */
async function clearStorage(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all))
}

/** Doc storage local raw. */
async function readRaw(): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(null)
}

describe('deleteLocalSidekickData', () => {
  beforeEach(async () => {
    await clearStorage()
  })

  it('xoa khoa co tien to sidekick.', async () => {
    await chrome.storage.local.set({
      'sidekick.settings': { theme: 'dark' },
      'sidekick.contextCache': { 'https://example.com': {} },
      'sidekick.draft.abc': 'ban nhap',
    })

    const removed = await deleteLocalSidekickData()
    expect(removed).toHaveLength(3)

    const raw = await readRaw()
    expect(Object.keys(raw)).toHaveLength(0)
  })

  it('giu trang thai onboarding va provider da chon', async () => {
    await chrome.storage.local.set({
      'sidekick.onboarding.completed': true,
      'sidekick.preferredProvider': 'gemini',
      'sidekick.settings': { theme: 'dark' },
    })

    await deleteLocalSidekickData()

    const raw = await readRaw()
    expect(raw['sidekick.onboarding.completed']).toBe(true)
    expect(raw['sidekick.preferredProvider']).toBe('gemini')
    expect(raw['sidekick.settings']).toBeUndefined()
  })

  it('khong xoa khoa khong lien quan cua Sidekick', async () => {
    await chrome.storage.local.set({
      'unrelated.key': 'giu lai',
      'sidekick.settings': { theme: 'dark' },
    })

    await deleteLocalSidekickData()

    const raw = await readRaw()
    expect(raw['unrelated.key']).toBe('giu lai')
    expect(raw['sidekick.settings']).toBeUndefined()
  })

  it('tra ve danh sach rong khi storage rong', async () => {
    await expect(deleteLocalSidekickData()).resolves.toEqual([])
  })

  it('tra ve danh sach rong khi storage nem loi', async () => {
    const spy = vi
      .spyOn(chrome.storage.local, 'get')
      .mockRejectedValueOnce(new Error('loi') as never)
    await expect(deleteLocalSidekickData()).resolves.toEqual([])
    spy.mockRestore()
  })
})

describe('deleteAllConversations (client)', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset()
  })

  it('goi DELETE /api/conversations va tra ve so da xoa', async () => {
    fetchJsonMock.mockResolvedValueOnce({ deleted: 7 })
    const { deleteAllConversations } = await import('../src/lib/conversationClient')

    await expect(deleteAllConversations()).resolves.toBe(7)
    expect(fetchJsonMock).toHaveBeenCalledWith('/api/conversations', { method: 'DELETE' })
  })
})
