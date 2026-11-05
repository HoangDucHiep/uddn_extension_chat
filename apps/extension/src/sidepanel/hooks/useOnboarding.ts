import { useCallback, useEffect, useState } from 'react'
import type { ProviderId } from '@sidekick/shared'
import {
  completeOnboarding,
  ONBOARDING_COMPLETED_KEY,
  readOnboardingState,
  resetOnboarding,
  writePreferredProvider,
} from '@/lib/onboarding'

/**
 * Hook `useOnboarding` — quan ly trang thai onboarding lan dau (FR-UX-02 — T-M1-25).
 *
 * Doc co "da hoan thanh chua" tu `chrome.storage.local` + lang nghe
 * `storage.onChanged` → khi user reset onboarding tu header, panel chuyen
 * ngay sang man hinh onboarding ma khong can reload.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */
export interface UseOnboardingResult {
  /** True khi can hien thi onboarding (chua hoan thanh). */
  isOnboardingRequired: boolean
  /** Dang doc trang thai tu storage. */
  isLoading: boolean
  /** Provider user chon trong buoc 2 (neu co). */
  preferredProvider: ProviderId | undefined
  /** Danh dau onboarding da xong → panel chuyen sang chat. */
  complete: (provider?: ProviderId) => Promise<void>
  /** Xoá co "da hoan thanh" → mo lai onboarding. */
  reset: () => Promise<void>
  /** Luu provider user chon. */
  setPreferredProvider: (provider: ProviderId) => Promise<void>
}

export function useOnboarding(): UseOnboardingResult {
  const [isOnboardingRequired, setIsOnboardingRequired] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [preferredProvider, setPreferredProviderState] = useState<ProviderId | undefined>(undefined)

  const reload = useCallback(async () => {
    const state = await readOnboardingState()
    setIsOnboardingRequired(!state.completed)
    setPreferredProviderState(state.preferredProvider)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Storage thay doi o noi khac (vd Settings) → dong bo lai trang thai.
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local') return
      if (!(ONBOARDING_COMPLETED_KEY in changes)) return
      void reload()
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [reload])

  const complete = useCallback(async (provider?: ProviderId): Promise<void> => {
    await completeOnboarding(provider)
    // Cap nhat state ngay de UI chuyen sang chat khong cho mot vong render.
    setIsOnboardingRequired(false)
    if (provider !== undefined) setPreferredProviderState(provider)
  }, [])

  const reset = useCallback(async (): Promise<void> => {
    await resetOnboarding()
    setIsOnboardingRequired(true)
  }, [])

  const setPreferredProvider = useCallback(async (provider: ProviderId): Promise<void> => {
    await writePreferredProvider(provider)
    setPreferredProviderState(provider)
  }, [])

  return {
    isOnboardingRequired,
    isLoading,
    preferredProvider,
    complete,
    reset,
    setPreferredProvider,
  }
}
