import { useState } from 'react'
import { ONBOARDING_STEPS, type OnboardingStep, type ProviderId } from '@sidekick/shared'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import type { TranslationKey } from '@/i18n'
import { StepPermissions } from './StepPermissions'
import { StepProvider } from './StepProvider'
import { StepTry } from './StepTry'

/**
 * Man hinh onboarding 3 buoc lan dau (FR-UX-02 — T-M1-25).
 *
 * Buoc 1 — giai thich quyen · Buoc 2 — chon provider + nhap key · Buoc 3 — thu
 * cau hoi that. User co the bo qua bat ky luc nao.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */

/** Key nhan tieu de cho tung buoc. */
const STEP_TITLE_KEY = {
  permissions: 'onboarding.step.permissions',
  provider: 'onboarding.step.provider',
  try: 'onboarding.step.try',
} as const satisfies Record<OnboardingStep, TranslationKey>

export interface OnboardingProps {
  /** Provider user chon (neu co). */
  preferredProvider: ProviderId | undefined
  /** Luu provider user chon. */
  onSelectProvider: (provider: ProviderId) => void
  /** Hoan tat onboarding → panel chuyen sang chat. */
  onComplete: (provider?: ProviderId) => void
}

export function Onboarding({
  preferredProvider,
  onSelectProvider,
  onComplete,
}: OnboardingProps) {
  const { t } = useI18n()
  const [stepIndex, setStepIndex] = useState(0)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | undefined>(
    preferredProvider,
  )

  const step: OnboardingStep = ONBOARDING_STEPS[stepIndex] ?? 'permissions'
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1

  const goNext = (): void => {
    if (isLastStep) {
      onComplete(selectedProvider)
      return
    }
    setStepIndex((current) => Math.min(current + 1, ONBOARDING_STEPS.length - 1))
  }

  const goBack = (): void => {
    setStepIndex((current) => Math.max(current - 1, 0))
  }

  const handleSelectProvider = (provider: ProviderId): void => {
    setSelectedProvider(provider)
    onSelectProvider(provider)
  }

  /** Bo qua onboarding → van coi nhu da hoan tat. */
  const handleSkip = (): void => {
    onComplete(selectedProvider)
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-[var(--surface-panel)]"
      data-testid="onboarding"
    >
      <header className="border-b border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)]">
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <h1 className="text-[length:var(--font-size-md)] font-semibold text-[var(--text-primary)]">
            {t('onboarding.title')}
          </h1>
          <span
            className="text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
            data-testid="onboarding-step-counter"
          >
            {t('onboarding.stepCounter', {
              current: stepIndex + 1,
              total: ONBOARDING_STEPS.length,
            })}{' '}
            · {t(STEP_TITLE_KEY[step])}
          </span>
        </div>

        {/* Thanh tien do — 3 cham, cham dang active duoc dam hon. */}
        <div className="mt-[var(--space-2)] flex gap-1" aria-hidden="true">
          {ONBOARDING_STEPS.map((item, index) => (
            <span
              key={item}
              className={`h-1 flex-1 rounded-[var(--radius-full)] ${
                index <= stepIndex ? 'bg-[var(--color-accent)]' : 'bg-[var(--border-default)]'
              }`}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-[var(--space-3)] py-[var(--space-4)]">
        {step === 'permissions' && <StepPermissions onNext={goNext} />}

        {step === 'provider' && (
          <StepProvider
            selectedProvider={selectedProvider}
            onSelect={handleSelectProvider}
            onNext={goNext}
          />
        )}

        {step === 'try' && (
          <StepTry
            provider={selectedProvider}
            onComplete={() => {
              onComplete(selectedProvider)
            }}
            onSkip={handleSkip}
          />
        )}
      </div>

      <footer className="flex items-center justify-between gap-[var(--space-2)] border-t border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)]">
        <button
          type="button"
          onClick={handleSkip}
          className="text-[length:var(--font-size-sm)] text-[var(--text-secondary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="onboarding-skip"
        >
          {t('onboarding.skip')}
        </button>
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="text-[length:var(--font-size-sm)] text-[var(--text-secondary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
            data-testid="onboarding-back"
          >
            {t('onboarding.back')}
          </button>
        )}
      </footer>
    </div>
  )
}
