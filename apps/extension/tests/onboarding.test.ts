import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeOnboarding,
  isProviderId,
  ONBOARDING_COMPLETED_KEY,
  PREFERRED_PROVIDER_KEY,
  readOnboardingState,
  readPreferredProvider,
  resetOnboarding,
  writePreferredProvider,
} from '../src/lib/onboarding'

/**
 * Unit test cho trang thai onboarding (FR-UX-02 — T-M1-25).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */

/** Doc truc tiep tu mock storage de kiem tra noi dung da ghi. */
async function readRaw(key: string): Promise<unknown> {
  const result = await chrome.storage.local.get(key)
  return result[key]
}

beforeEach(async () => {
  // Xoa sach storage giua cac test.
  await chrome.storage.local.remove([
    ONBOARDING_COMPLETED_KEY,
    PREFERRED_PROVIDER_KEY,
  ])
  vi.clearAllMocks()
})

describe('readOnboardingState', () => {
  it('chua hoan thanh khi storage trong', async () => {
    const state = await readOnboardingState()

    expect(state.completed).toBe(false)
    expect(state.preferredProvider).toBeUndefined()
  })

  it('completed = true sau khi goi completeOnboarding', async () => {
    await completeOnboarding()

    const state = await readOnboardingState()

    expect(state.completed).toBe(true)
  })
})

describe('completeOnboarding', () => {
  it('ghi co completed = true', async () => {
    await completeOnboarding()

    expect(await readRaw(ONBOARDING_COMPLETED_KEY)).toBe(true)
  })

  it('ghi them provider da chon', async () => {
    await completeOnboarding('groq')

    expect(await readRaw(ONBOARDING_COMPLETED_KEY)).toBe(true)
    expect(await readRaw(PREFERRED_PROVIDER_KEY)).toBe('groq')
  })

  it('khong ghi provider khi khong truyen', async () => {
    await completeOnboarding()

    expect(await readRaw(PREFERRED_PROVIDER_KEY)).toBeUndefined()
  })
})

describe('resetOnboarding', () => {
  it('xoá co completed → onboarding hien thi lai', async () => {
    await completeOnboarding('groq')

    await resetOnboarding()

    const state = await readOnboardingState()
    expect(state.completed).toBe(false)
    // Provider da chon van duoc giu de user khong phai nhap lai key.
    expect(state.preferredProvider).toBe('groq')
  })
})

describe('preferredProvider', () => {
  it('writePreferredProvider luu provider', async () => {
    await writePreferredProvider('ollama')

    expect(await readPreferredProvider()).toBe('ollama')
  })

  it('readPreferredProvider tra undefined khi chua chon', async () => {
    expect(await readPreferredProvider()).toBeUndefined()
  })

  it('writePreferredProvider nem loi voi provider khong hop le', async () => {
    await expect(writePreferredProvider('anthropic' as never)).rejects.toThrow(
      /Provider không hợp lệ/,
    )
  })
})

describe('isProviderId', () => {
  it('accept provider hop le', () => {
    for (const provider of ['mock', 'groq', 'openrouter', 'gemini', 'ollama'] as const) {
      expect(isProviderId(provider)).toBe(true)
    }
  })

  it('reject provider khong hop le', () => {
    expect(isProviderId('anthropic')).toBe(false)
    expect(isProviderId(undefined)).toBe(false)
    expect(isProviderId(42)).toBe(false)
  })
})
