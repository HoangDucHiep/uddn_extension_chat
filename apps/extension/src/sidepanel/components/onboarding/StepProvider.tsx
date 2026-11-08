import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, Loader2 } from 'lucide-react'
import type { ProviderId, ProviderInfo } from '@sidekick/shared'
import { Button } from '@/components/ui/button'
import { listProviders } from '@/lib/providerClient'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import type { TranslationKey } from '@/i18n'

/**
 * Buoc 2 cua onboarding — chon provider (FR-UX-02).
 *
 * Provider khong can key (mock, ollama local) → chi can chon.
 * Provider can key → dung **key cua nhom (K1)** trong `.env` cua BFF.
 *
 * T-M1-15 (K3 direct) + T-M1-16 (K2 BYOK UI) **tam dung** (quyet dinh
 * user 2026-11-08) → o nhap API key bi go khoi UI. Server van giu endpoint
 * `POST /api/providers/keys` va bang `provider_keys` de mo lai duoc sau
 * (chi can bo o nhap key + them section Settings).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6, ADR-9
 */

/** Key nhan hien thi cua nguon key. */
const KEY_SOURCE_LABEL_KEY = {
  K1: 'onboarding.provider.keySource.K1',
  K2: 'onboarding.provider.keySource.K2',
  K3: 'onboarding.provider.keySource.K3',
  none: 'onboarding.provider.keySource.none',
} as const satisfies Record<ProviderInfo['keySource'], TranslationKey>

export interface StepProviderProps {
  /** Provider user chon (neu co). */
  selectedProvider: ProviderId | undefined
  /** Thong bao provider da chon → luu thanh mac dinh. */
  onSelect: (provider: ProviderId) => void
  /** Chuyen sang buoc sau. */
  onNext: () => void
}

export function StepProvider({ selectedProvider, onSelect, onNext }: StepProviderProps) {
  const { t } = useI18n()
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setLoadError(undefined)
    try {
      setProviders(await listProviders())
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Provider dang chon (fallback ve provider dau tien san dung). */
  const activeProvider: ProviderInfo | undefined =
    providers.find((provider) => provider.id === selectedProvider) ??
    providers.find((provider) => provider.available)

  /** Provider da chon co can key nhung **chua** co key nao san dung. */
  const needsKey =
    activeProvider !== undefined &&
    activeProvider.requiresKey &&
    activeProvider.keySource !== 'K1' &&
    activeProvider.keySource !== 'K2'

  const handleSelect = (provider: ProviderInfo): void => {
    onSelect(provider.id)
  }

  return (
    <section className="flex flex-col gap-[var(--space-4)]" data-testid="onboarding-step-provider">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]">
          {t('onboarding.provider.title')}
        </h2>
        <p className="text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
          {t('onboarding.provider.description')}
        </p>
      </header>

      {isLoading && (
        <p
          className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
          data-testid="onboarding-providers-loading"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('onboarding.provider.loading')}
        </p>
      )}

      {loadError !== undefined && (
        <div
          className="rounded-[var(--radius-md)] bg-[var(--danger-subtle)] px-[var(--space-3)] py-[var(--space-2)]"
          data-testid="onboarding-providers-error"
        >
          <p className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" aria-hidden="true" />
            {t('onboarding.provider.loadError', { error: loadError })}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              void load()
            }}
          >
            {t('onboarding.provider.retry')}
          </Button>
        </div>
      )}

      {!isLoading && loadError === undefined && (
        <ul
          className="flex flex-col gap-[var(--space-2)]"
          role="radiogroup"
          aria-label={t('onboarding.provider.groupLabel')}
        >
          {providers.map((provider) => {
            const isActive = provider.id === activeProvider?.id
            return (
              <li key={provider.id}>
                <label
                  className={`flex cursor-pointer items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] ${
                    isActive
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-raised)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="onboarding-provider"
                    value={provider.id}
                    checked={isActive}
                    onChange={() => {
                      handleSelect(provider)
                    }}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                    data-testid={`onboarding-provider-${provider.id}`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-primary)]">
                        {provider.name}
                      </span>
                      {provider.available ? (
                        <span className="text-[length:var(--font-size-xs)] text-[var(--success)]">
                          {t('onboarding.provider.available')}
                        </span>
                      ) : (
                        <span className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                          {t('onboarding.provider.unavailable')}
                        </span>
                      )}
                    </span>
                    <span className="text-[length:var(--font-size-xs)] text-[var(--text-secondary)]">
                      {t(KEY_SOURCE_LABEL_KEY[provider.keySource])}
                      {provider.models.length > 0 ? ` · ${provider.models.join(', ')}` : ''}
                    </span>
                    {provider.note !== undefined && (
                      <span
                        className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
                        data-testid={`onboarding-provider-note-${provider.id}`}
                      >
                        {provider.note}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {needsKey && (
        <div
          className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--warning-subtle)] px-[var(--space-3)] py-[var(--space-2)]"
          data-testid="onboarding-key-required"
        >
          <CircleAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]"
            aria-hidden="true"
          />
          <p className="text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
            {t('onboarding.provider.keyRequired', {
              provider: activeProvider?.name ?? '',
            })}
          </p>
        </div>
      )}

      <Button onClick={onNext} data-testid="onboarding-next">
        {t('onboarding.next')}
      </Button>
    </section>
  )
}
