/**
 * Helper doc/ghi `chrome.storage.local`.
 *
 * Moi thao tac deu bat loi → storage khong truy cap duoc (vd dev ngoai
 * extension) thi dung gia tri mac dinh thay vi lam panel crash.
 *
 * Docs: docs/SYSTEM_DESIGN.md §3 (lib/storage.ts)
 */

/** Khoa luu trang thai bat/tat context. */
export const CONTEXT_ENABLED_STORAGE_KEY = 'sidekick.contextEnabled'

/**
 * Doc trang thai bat/tat context da luu.
 *
 * Mac dinh `false` — context chi duoc gui khi user chu dong dinh kem.
 */
export async function readContextEnabled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(CONTEXT_ENABLED_STORAGE_KEY)
    return stored[CONTEXT_ENABLED_STORAGE_KEY] === true
  } catch {
    return false
  }
}

/** Luu trang thai bat/tat context. */
export async function writeContextEnabled(enabled: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [CONTEXT_ENABLED_STORAGE_KEY]: enabled })
  } catch {
    // Storage khong truy cap duoc → bo qua, state trong RAM van dung.
  }
}
