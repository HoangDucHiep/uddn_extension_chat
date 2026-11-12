/**
 * Trang thai onboarding lan dau (FR-UX-02 — T-M1-25).
 *
 * Luu trong `chrome.storage.local`:
 *  - `sidekick.onboarding.completed` → boolean, onboarding da chay xong
 *  - `sidekick.preferredProvider`   → provider user chon trong onboarding
 *
 * Khong dung React/Zustand o day de file nay **thuan** → test duoc truc tiep.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */

import { PROVIDER_IDS, type ProviderId } from '@sidekick/shared'

/** Khoa storage: onboarding da hoan thanh chua. */
export const ONBOARDING_COMPLETED_KEY = 'sidekick.onboarding.completed'

/** Khoa storage: provider user chon trong buoc 2 cua onboarding. */
export const PREFERRED_PROVIDER_KEY = 'sidekick.preferredProvider'

/** Trang thai onboarding hien tai. */
export interface OnboardingState {
  /** True khi user da xem qua onboarding (hoac bo qua). */
  completed: boolean
  /** Provider user chon — undefined neu chua chon. */
  preferredProvider: ProviderId | undefined
}

/**
 * Doc trang thai onboarding.
 *
 * Loi storage (extension context khong hop le) → tra trang thai "chua hoan
 * thanh" de onboarding van hien thi thay vi panel trong.
 */
export async function readOnboardingState(): Promise<OnboardingState> {
  try {
    const stored = await chrome.storage.local.get([
      ONBOARDING_COMPLETED_KEY,
      PREFERRED_PROVIDER_KEY,
    ])

    const completed = stored[ONBOARDING_COMPLETED_KEY] === true
    const provider = stored[PREFERRED_PROVIDER_KEY]

    return {
      completed,
      preferredProvider: isProviderId(provider) ? provider : undefined,
    }
  } catch {
    return { completed: false, preferredProvider: undefined }
  }
}

/**
 * Danh dau onboarding da hoan thanh.
 *
 * @param preferredProvider - Provider user chon (neu co) → luu luon de
 *   dung lam mac dinh cho cac luot chat sau.
 */
export async function completeOnboarding(preferredProvider?: ProviderId): Promise<void> {
  const payload: Record<string, unknown> = { [ONBOARDING_COMPLETED_KEY]: true }
  if (preferredProvider !== undefined) {
    payload[PREFERRED_PROVIDER_KEY] = preferredProvider
  }

  try {
    await chrome.storage.local.set(payload)
  } catch {
    // Storage khong ghi duoc → onboarding se hien thi lai, khong phai loi chan.
  }
}

/**
 * Xoá co "da hoan thanh" → mo lai onboarding tu header.
 *
 * Giu nguyen `preferredProvider` de user khong phai nhap lai key.
 */
export async function resetOnboarding(): Promise<void> {
  try {
    await chrome.storage.local.remove(ONBOARDING_COMPLETED_KEY)
  } catch {
    // Bo qua — xem nhu reset thanh cong.
  }
}

/** Doc provider user chon. */
export async function readPreferredProvider(): Promise<ProviderId | undefined> {
  const state = await readOnboardingState()
  return state.preferredProvider
}

/**
 * Luu provider user chon.
 *
 * Provider khong hop le → nem loi (bi can o bien).
 */
export async function writePreferredProvider(providerId: ProviderId): Promise<void> {
  if (!isProviderId(providerId)) {
    throw new Error(`Provider không hợp lệ: "${providerId}"`)
  }
  await chrome.storage.local.set({ [PREFERRED_PROVIDER_KEY]: providerId })
}

/** Kiem tra gia tri co phai `ProviderId` hay khong. */
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}
