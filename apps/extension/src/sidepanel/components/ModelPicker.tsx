import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronsUpDown, Loader2, Search } from 'lucide-react'
import type { ProviderId, ProviderInfo } from '@sidekick/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { listProviderModels, listProviders } from '@/lib/providerClient'
import {
  readModelSelection,
  writeModelSelection,
  type ModelSelection,
} from '@/lib/modelSelection'
import { useI18n } from '@/sidepanel/hooks/useI18n'

/**
 * Model picker — chon provider + model (T-M2-02 — FR-PROVIDER-03).
 *
 * - Danh sach provider lay tu `GET /api/providers` (chi provider `available`).
 * - Danh sach model lay tu `GET /api/providers/:id/models` (discovery dong).
 * - Lua chon duoc luu trong `chrome.storage.local` → moi luot chat gui
 *   `provider` + `model` len BFF.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
 */

/** So model toi da hien thi truoc khi can tim kiem. */
const MODEL_SEARCH_THRESHOLD = 12

export interface ModelPickerProps {
  /** Provider dang hoat dong (tu SSE `meta`) — chi de hien thi. */
  activeProvider?: string | undefined
  /** Model dang hoat dong (tu SSE `meta`) — chi de hien thi. */
  activeModel?: string | undefined
  /** Thong bao khi lua chon thay doi (de parent cap nhat state). */
  onSelectionChange?: (selection: ModelSelection) => void
}

/**
 * Model picker trong header panel.
 *
 * @param props - Props cua picker.
 */
export function ModelPicker({ activeProvider, activeModel, onSelectionChange }: ModelPickerProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selected, setSelected] = useState<ModelSelection>({
    providerId: undefined,
    model: undefined,
  })
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | undefined>(undefined)
  const [models, setModels] = useState<string[]>([])
  const [isModelSourceFallback, setIsModelSourceFallback] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')

  // Nap lua chon da luu + danh sach provider khi mo picker.
  useEffect(() => {
    if (!isOpen) return

    let isCancelled = false

    const load = async (): Promise<void> => {
      setIsLoading(true)
      setError(undefined)

      const stored = await readModelSelection()
      if (isCancelled) return
      setSelected(stored)

      try {
        const items = await listProviders()
        if (isCancelled) return
        setProviders(items)
        setSelectedProviderId(stored.providerId ?? items.find((item) => item.available)?.id)
      } catch (cause) {
        if (isCancelled) return
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      isCancelled = true
    }
  }, [isOpen])

  // Nap danh sach model cua provider dang chon.
  useEffect(() => {
    if (!isOpen || selectedProviderId === undefined) return

    let isCancelled = false

    const load = async (): Promise<void> => {
      setIsLoading(true)
      setError(undefined)
      try {
        const result = await listProviderModels(selectedProviderId)
        if (isCancelled) return
        setModels(result.models)
        setIsModelSourceFallback(result.source === 'fallback')
      } catch (cause) {
        if (isCancelled) return
        setModels([])
        setIsModelSourceFallback(true)
        setError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      isCancelled = true
    }
  }, [isOpen, selectedProviderId])

  const visibleModels = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (normalized.length === 0) return models
    return models.filter((model) => model.toLowerCase().includes(normalized))
  }, [models, query])

  /** Luu lua chon moi + bao parent. */
  const applySelection = useCallback(
    async (next: ModelSelection): Promise<void> => {
      setSelected(next)
      await writeModelSelection(next)
      onSelectionChange?.(next)
    },
    [onSelectionChange],
  )

  const handleSelectProvider = useCallback(
    (providerId: ProviderId): void => {
      setSelectedProviderId(providerId)
      setQuery('')
      // Doi provider → xoa model da chon (model cua provider khac khong dung).
      void applySelection({ providerId, model: undefined })
    },
    [applySelection],
  )

  const handleSelectModel = useCallback(
    (model: string): void => {
      void applySelection({ providerId: selectedProviderId, model })
    },
    [applySelection, selectedProviderId],
  )

  const handleReset = useCallback((): void => {
    setSelectedProviderId(undefined)
    setQuery('')
    void applySelection({ providerId: undefined, model: undefined })
  }, [applySelection])

  // Nhan cua nut trigger: provider/model **thuc su** dang chay (SSE `meta`).
  const triggerLabel =
    activeProvider !== undefined && activeProvider.length > 0
      ? `${activeProvider}${activeModel !== undefined ? ` · ${activeModel}` : ''}`
      : (selected.providerId ?? t('modelPicker.currentDefault'))

  const availableProviders = providers.filter((provider) => provider.available)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('modelPicker.open')}
          title={triggerLabel}
          data-testid="model-picker-button"
        >
          <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex max-h-[420px] w-[280px] flex-col gap-2 p-[var(--space-2)]"
        data-testid="model-picker"
      >
        <p className="text-[length:var(--font-size-sm)] font-semibold text-[var(--text-primary)]">
          {t('modelPicker.title')}
        </p>

        {/* --- Chon provider --- */}
        <div className="flex flex-col gap-1">
          <span className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            {t('modelPicker.providerLabel')}
          </span>
          <ul className="max-h-[140px] overflow-y-auto" data-testid="model-picker-providers">
            {availableProviders.map((provider) => {
              const isActive = provider.id === selectedProviderId
              return (
                <li key={provider.id}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectProvider(provider.id)
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-left text-[length:var(--font-size-sm)] hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
                      isActive
                        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-hover)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                    data-testid={`model-picker-provider-${provider.id}`}
                    aria-pressed={isActive}
                  >
                    <span className="truncate">{provider.name}</span>
                    {provider.requiresKey ? (
                      <span className="shrink-0 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                        {provider.keySource}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* --- Chon model --- */}
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <span className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
            {t('modelPicker.modelLabel')}
          </span>

          {models.length > MODEL_SEARCH_THRESHOLD ? (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                }}
                placeholder={t('modelPicker.searchPlaceholder')}
                aria-label={t('modelPicker.searchLabel')}
                className="pl-7"
                data-testid="model-picker-search"
              />
            </div>
          ) : null}

          {isLoading ? (
            <p
              className="flex items-center gap-2 text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
              data-testid="model-picker-loading"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t('modelPicker.loading')}
            </p>
          ) : null}

          {isModelSourceFallback && models.length > 0 ? (
            <p
              className="text-[length:var(--font-size-xs)] text-[var(--warning)]"
              data-testid="model-picker-fallback-notice"
            >
              {t('modelPicker.fallbackNotice')}
            </p>
          ) : null}

          {error !== undefined ? (
            <p
              className="text-[length:var(--font-size-xs)] text-[var(--danger)]"
              data-testid="model-picker-error"
            >
              {t('modelPicker.error')}
            </p>
          ) : null}

          {!isLoading && visibleModels.length === 0 && error === undefined ? (
            <p
              className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
              data-testid="model-picker-empty"
            >
              {t('modelPicker.empty')}
            </p>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto" data-testid="model-picker-models">
            {visibleModels.map((model) => {
              const isActive = model === selected.model
              return (
                <li key={model}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectModel(model)
                    }}
                    className={`flex w-full items-center rounded-[var(--radius-sm)] px-2 py-1 text-left text-[length:var(--font-size-sm)] hover:bg-[var(--surface-sunken)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
                      isActive
                        ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent-hover)]'
                        : 'text-[var(--text-primary)]'
                    }`}
                    data-testid={`model-picker-model-${model}`}
                    aria-pressed={isActive}
                  >
                    <span className="truncate">{model}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="self-start rounded-[var(--radius-sm)] px-2 py-1 text-[length:var(--font-size-xs)] text-[var(--text-secondary)] underline hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="model-picker-reset"
        >
          {t('modelPicker.reset')}
        </button>
      </PopoverContent>
    </Popover>
  )
}
