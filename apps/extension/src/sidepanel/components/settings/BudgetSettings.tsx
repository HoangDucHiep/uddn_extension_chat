import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  DEFAULT_BUDGET_WARN_PERCENT,
  type BudgetPeriod,
  type BudgetSettings as BudgetSettingsModel,
} from '@sidekick/shared'
import { fetchBudgetStatus, updateBudgetSettings } from '@/lib/budgetClient'
import { formatCostUsd } from '@/lib/costFormat'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { useBudgetStore } from '@/sidepanel/store/budgetStore'
import { RadioGroup, SettingsSection, ToggleRow } from './SettingsControls'

/**
 * Section "Ngan sach chi phi" trong drawer Settings (T-M2-03b — FR-PROVIDER-06).
 *
 * Cau hinh **luu phia server** (bang `budget_settings`) → server tu enforce
 * (chan luot chat moi khi vuot han muc). Client chi doc/ghi qua
 * `GET/PUT /api/budget`.
 *
 * Loi API → hien **inline**, khong lam **sập** drawer Settings.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7 · docs/SYSTEM_DESIGN.md §7.24
 */

/** Gia tri ban dau cua form (khi chua nap duoc config tu server). */
const FALLBACK_SETTINGS: BudgetSettingsModel = {
  enabled: false,
  limitUsd: 0,
  period: 'monthly',
  warnThresholdPercent: DEFAULT_BUDGET_WARN_PERCENT,
  hardBlock: true,
}

export function BudgetSettings() {
  const { t } = useI18n()
  const setStatus = useBudgetStore((state) => state.setStatus)
  const currentStatus = useBudgetStore((state) => state.status)

  const [settings, setSettings] = useState<BudgetSettingsModel>(FALLBACK_SETTINGS)
  const [limitInput, setLimitInput] = useState('0')
  const [warnInput, setWarnInput] = useState(String(DEFAULT_BUDGET_WARN_PERCENT))
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setHasError(false)
    try {
      const status = await fetchBudgetStatus()
      setStatus(status)
      setSettings(status.settings)
      setLimitInput(String(status.settings.limitUsd))
      setWarnInput(String(status.settings.warnThresholdPercent))
    } catch {
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [setStatus])

  useEffect(() => {
    void load()
  }, [load])

  /** Luu cau hinh → server upsert → tra trang thai moi. */
  const save = useCallback(async (): Promise<void> => {
    const limitUsd = Number(limitInput)
    const warnThresholdPercent = Number(warnInput)

    if (!Number.isFinite(limitUsd) || limitUsd < 0) {
      setHasError(true)
      return
    }
    if (!Number.isInteger(warnThresholdPercent) || warnThresholdPercent < 1 || warnThresholdPercent > 100) {
      setHasError(true)
      return
    }

    setIsSaving(true)
    setHasError(false)
    try {
      const status = await updateBudgetSettings({
        ...settings,
        limitUsd,
        warnThresholdPercent,
      })
      setStatus(status)
      setSettings(status.settings)
      setIsSaved(true)
      toast.success(t('budget.settings.saved'))
    } catch {
      setHasError(true)
      toast.error(t('budget.settings.saveError'))
    } finally {
      setIsSaving(false)
    }
  }, [limitInput, settings, setStatus, t, warnInput])

  const spent = formatCostUsd(currentStatus?.spentUsd)

  return (
    <SettingsSection title={t('budget.settings.title')} description={t('budget.settings.description')}>
      <ToggleRow
        label={t('budget.settings.enable')}
        description={t('budget.settings.enableDescription')}
        checked={settings.enabled}
        onChange={(enabled) => {
          setSettings((prev) => ({ ...prev, enabled }))
          setIsSaved(false)
        }}
        testId="budget-settings-enabled"
      />

      <div className="space-y-1">
        <label
          className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
          htmlFor="budget-settings-limit"
        >
          {t('budget.settings.limit')}
        </label>
        <input
          id="budget-settings-limit"
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={limitInput}
          onChange={(event) => {
            setLimitInput(event.target.value)
            setIsSaved(false)
          }}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="budget-settings-limit"
        />
      </div>

      <RadioGroup<BudgetPeriod>
        label={t('budget.settings.period')}
        value={settings.period}
        options={[
          { value: 'daily', label: t('budget.settings.periodDaily') },
          { value: 'monthly', label: t('budget.settings.periodMonthly') },
        ]}
        onChange={(period) => {
          setSettings((prev) => ({ ...prev, period }))
          setIsSaved(false)
        }}
        testId="budget-settings-period"
      />

      <div className="space-y-1">
        <label
          className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
          htmlFor="budget-settings-warn"
        >
          {t('budget.settings.warnThreshold')}
        </label>
        <input
          id="budget-settings-warn"
          type="number"
          min={1}
          max={100}
          step={1}
          inputMode="numeric"
          value={warnInput}
          onChange={(event) => {
            setWarnInput(event.target.value)
            setIsSaved(false)
          }}
          className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-[length:var(--font-size-sm)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          data-testid="budget-settings-warn"
        />
      </div>

      <ToggleRow
        label={t('budget.settings.hardBlock')}
        description={t('budget.settings.hardBlockDescription')}
        checked={settings.hardBlock}
        onChange={(hardBlock) => {
          setSettings((prev) => ({ ...prev, hardBlock }))
          setIsSaved(false)
        }}
        testId="budget-settings-hard-block"
      />

      <p
        className="text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]"
        data-testid="budget-settings-status"
      >
        {t('budget.settings.spentOfLimit', {
          spent: spent.length > 0 ? spent : '0',
          limit: formatCostUsd(settings.limitUsd) || '0',
        })}
      </p>

      {hasError ? (
        <p
          className="text-[length:var(--font-size-xs)] text-[var(--danger)]"
          data-testid="budget-settings-error"
        >
          {t('budget.settings.error')}
        </p>
      ) : null}

      {isSaved && !hasError ? (
        <p
          className="text-[length:var(--font-size-xs)] text-[var(--success)]"
          data-testid="budget-settings-saved"
        >
          {t('budget.settings.saved')}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          void save()
        }}
        disabled={isSaving || isLoading}
        className="inline-flex items-center gap-1 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 py-1.5 text-[length:var(--font-size-xs)] font-medium text-[var(--color-accent-contrast)] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        data-testid="budget-settings-save"
      >
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="h-3 w-3" aria-hidden="true" />
        )}
        {t('budget.settings.save')}
      </button>
    </SettingsSection>
  )
}
