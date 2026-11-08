import { useState } from 'react'
import { Toaster } from 'sonner'
import { ChatWorkspace } from './ChatWorkspace'
import { Onboarding } from './components/onboarding/Onboarding'
import { I18nProvider } from './components/I18nProvider'
import { useOnboarding } from './hooks/useOnboarding'
import { useSettings } from './hooks/useSettings'
import { useI18n } from './hooks/useI18n'

/**
 * App shell cua side panel.
 *
 * Quyet dinh 2 nhanh:
 *  - chua hoan thanh onboarding → hien thi `<Onboarding />` (FR-UX-02 — T-M1-25)
 *  - da hoan thanh → hien thi `<ChatWorkspace />`
 *
 * Chat van la 1 man hinh chinh (DP-2) — onboarding chi la lop UI tam thoi,
 * mo lai duoc tu nut "Huong dan" trong header.
 *
 * `useSettings()` o day (khong phai trong `SettingsDrawer`) de **ngon ngu**
 * la nguon su that duy nhat cho ca panel: `I18nProvider` boc toan bo cay →
 * doi `uiLanguage` trong Settings ap dung **ngay** cho ca thread + drawer
 * (FR-SETTINGS-06 — T-M1-17).
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

  const { settings, update } = useSettings()

  // User bam "Huong dan" trong header → mo lai onboarding (override local).
  const [isOnboardingForced, setIsOnboardingForced] = useState(false)

  const showOnboarding = !isLoading && (isOnboardingRequired || isOnboardingForced)

  if (showOnboarding) {
    return (
      <I18nProvider language={settings.uiLanguage}>
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
        <Toaster position="bottom-center" />
      </I18nProvider>
    )
  }

  return (
    <I18nProvider language={settings.uiLanguage}>
      {/* Skip-link (FR-UX-09 — T-M1-20).
          An cho toi khi focus → nguoi dung ban phim di thang toi o nhap. */}
      <SkipLink />
      <ChatWorkspace
        settings={settings}
        onSettingsChange={(patch) => {
          return update(patch)
        }}
        onOpenOnboarding={() => {
          setIsOnboardingForced(true)
          void reset()
        }}
      />
      <Toaster position="bottom-center" />
    </I18nProvider>
  )
}

/**
 * Skip-link "Bỏ qua tới ô nhập" (FR-UX-09 — T-M1-20).
 *
 * Anchor toi `sidekick-composer-input` (id cua textarea trong `Composer`).
 * Dùng `sr-only` → chi lo khi focus (WCAG 2.4.1 Bypass Blocks).
 */
function SkipLink() {
  const { t } = useI18n()
  return (
    <a
      href="#sidekick-composer-input"
      className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-[var(--space-2)] focus:top-[var(--space-2)] focus:rounded-[var(--radius-sm)] focus:bg-[var(--surface-overlay)] focus:px-3 focus:py-2 focus:text-[length:var(--font-size-sm)] focus:text-[var(--text-primary)] focus:shadow-[var(--shadow-2)] focus:outline-2 focus:outline-offset-2 focus:outline-[var(--border-focus)]"
      data-testid="skip-link"
    >
      {t('a11y.skipToComposer')}
    </a>
  )
}
