import { useCallback, useEffect, useState } from 'react'
import { Check, CircleAlert, Loader2 } from 'lucide-react'
import type { ProviderId, ProviderInfo } from '@sidekick/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/apiClient'
import { listProviders, saveProviderKey, testProviderKey } from '@/lib/providerClient'

/**
 * Buoc 2 cua onboarding — chon provider + nhap API key (FR-UX-02).
 *
 * Provider khong can key (mock, ollama local) → chi can chon.
 * Provider can key → nhap key → `POST /api/providers/keys` (luu K2 trong
 * Postgres, ma hoa AES-256-GCM) → `POST /api/providers/keys/:id/test` de
 * xac nhan key thuc su hoat dong.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6, FR-PROVIDER-02
 */

/** Nhan hien thi cua nguon key. */
const KEY_SOURCE_LABELS: Record<ProviderInfo['keySource'], string> = {
  K1: 'Key do nhom cap',
  K2: 'Key ban da luu',
  K3: 'Key gui thang',
  none: 'Khong can key',
}

export interface StepProviderProps {
  /** Provider user chon (neu co). */
  selectedProvider: ProviderId | undefined
  /** Thong bao provider da chon → luu thanh mac dinh. */
  onSelect: (provider: ProviderId) => void
  /** Chuyen sang buoc sau. */
  onNext: () => void
}

export function StepProvider({ selectedProvider, onSelect, onNext }: StepProviderProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | undefined>(undefined)

  const [apiKey, setApiKey] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [keyError, setKeyError] = useState<string | undefined>(undefined)
  const [keyStatus, setKeyStatus] = useState<string | undefined>(undefined)
  const [savedKeyId, setSavedKeyId] = useState<string | undefined>(undefined)

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

  /** Provider da chon co can key chua? */
  const needsKey =
    activeProvider !== undefined &&
    activeProvider.requiresKey &&
    activeProvider.keySource !== 'K1' &&
    activeProvider.keySource !== 'K2'

  /**
   * Luu key vao BFF (K2) roi kiem tra key co hoat dong khong.
   */
  const handleSaveKey = async (): Promise<void> => {
    if (activeProvider === undefined) return
    const trimmed = apiKey.trim()
    if (trimmed.length < 8) {
      setKeyError('API key qua ngan (it nhat 8 ky tu).')
      setKeyStatus(undefined)
      return
    }

    setIsSaving(true)
    setKeyError(undefined)
    setKeyStatus(undefined)

    try {
      const record = await saveProviderKey(activeProvider.id, trimmed)
      setSavedKeyId(record.id)

      const result = await testProviderKey(record.id)
      if (result.ok) {
        setKeyStatus(`Key da luu va hoat dong (${activeProvider.name} · ${record.masked}).`)
        setApiKey('')
        // Tai lai danh sach → keySource chuyen tu "none" sang "K2".
        await load()
      } else {
        setKeyStatus(undefined)
        setKeyError(result.error ?? 'Key khong hop le.')
      }
    } catch (error) {
      setKeyError(
        error instanceof ApiError ? error.message : 'Khong luu duoc API key. Thu lai sau.',
      )
      setKeyStatus(undefined)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSelect = (provider: ProviderInfo): void => {
    onSelect(provider.id)
    setKeyError(undefined)
    setKeyStatus(undefined)
    setSavedKeyId(undefined)
  }

  return (
    <section className="flex flex-col gap-[var(--space-4)]" data-testid="onboarding-step-provider">
      <header className="flex flex-col gap-1">
        <h2 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]">
          Chon mo hinh AI
        </h2>
        <p className="text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
          Sidekick AI ho tro ca mo hinh cloud (can API key) va Ollama chay cuc bo (khong can
          key). Ban co the doi lai sau trong phan cai dat.
        </p>
      </header>

      {isLoading && (
        <p
          className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
          data-testid="onboarding-providers-loading"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Dang tai danh sach mo hinh...
        </p>
      )}

      {loadError !== undefined && (
        <div
          className="rounded-[var(--radius-md)] bg-[var(--danger-subtle)] px-[var(--space-3)] py-[var(--space-2)]"
          data-testid="onboarding-providers-error"
        >
          <p className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" aria-hidden="true" />
            Khong tai duoc danh sach mo hinh: {loadError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => {
              void load()
            }}
          >
            Thu lai
          </Button>
        </div>
      )}

      {!isLoading && loadError === undefined && (
        <ul className="flex flex-col gap-[var(--space-2)]" role="radiogroup" aria-label="Chon mo hinh AI">
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
                          san dung
                        </span>
                      ) : (
                        <span className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                          chua san dung
                        </span>
                      )}
                    </span>
                    <span className="text-[length:var(--font-size-xs)] text-[var(--text-secondary)]">
                      {KEY_SOURCE_LABELS[provider.keySource]}
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
        <div className="flex flex-col gap-[var(--space-2]">
          <label
            className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-primary)]"
            htmlFor="onboarding-api-key"
          >
            API key cho {activeProvider?.name ?? 'mo hinh da chon'}
          </label>
          <Input
            id="onboarding-api-key"
            type="password"
            value={apiKey}
            autoComplete="off"
            placeholder="Dán API key cua ban"
            onChange={(event) => {
              setApiKey(event.target.value)
            }}
            data-testid="onboarding-api-key"
          />
          <p className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            Key duoc ma hoa AES-256-GCM truoc khi luu vao database cuc bo. Key khong bao gio
            gui ra ngoai.
          </p>
          {keyError !== undefined && (
            <p
              className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--danger)]"
              data-testid="onboarding-key-error"
            >
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {keyError}
            </p>
          )}
          {keyStatus !== undefined && (
            <p
              className="flex items-center gap-2 text-[length:var(--font-size-sm)] text-[var(--success)]"
              data-testid="onboarding-key-success"
            >
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {keyStatus}
            </p>
          )}
          <Button
            variant="outline"
            onClick={() => {
              void handleSaveKey()
            }}
            disabled={isSaving}
            data-testid="onboarding-save-key"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Luu & kiem tra
          </Button>
          {savedKeyId !== undefined && (
            <span className="sr-only" data-testid="onboarding-saved-key-id">
              {savedKeyId}
            </span>
          )}
        </div>
      )}

      <Button onClick={onNext} data-testid="onboarding-next">
        Tiep tuc
      </Button>
    </section>
  )
}
