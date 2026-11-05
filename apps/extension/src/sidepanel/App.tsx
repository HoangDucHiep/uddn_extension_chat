import { useState } from 'react'
import { ChatWorkspace } from './ChatWorkspace'
import { Onboarding } from './components/onboarding/Onboarding'
import { useOnboarding } from './hooks/useOnboarding'

/**
 * App shell cua side panel.
 *
 * Quyet dinh 2 nhanh:
 *  - chua hoan thanh onboarding → hien thi `<Onboarding />` (FR-UX-02 — T-M1-25)
 *  - da hoan thanh → hien thi `<ChatWorkspace />`
 *
 * Chat van la 1 man hinh chinh (DP-2) — onboarding chi la lop UI tam thoi,
 * mo lai duoc tu nut "Huong dan" trong header.
 */
export function App() {
  const {
    isOnboardingRequired,
    isLoading,
    preferredProvider,
    complete,
    reset,
    setPreferredProvider,
  } = useOnboarding()

  // User bam "Huong dan" trong header → mo lai onboarding (override local).
  const [isOnboardingForced, setIsOnboardingForced] = useState(false)

  const showOnboarding = !isLoading && (isOnboardingRequired || isOnboardingForced)

  if (showOnboarding) {
    return (
      <Onboarding
        preferredProvider={preferredProvider}
        onSelectProvider={(provider) => {
          void setPreferredProvider(provider)
        }}
        onComplete={(provider) => {
          setIsOnboardingForced(false)
          void complete(provider)
        }}
      />
    )
  }

  return (
    <ChatWorkspace
      onOpenOnboarding={() => {
        setIsOnboardingForced(true)
        void reset()
      }}
    />
  )
}
