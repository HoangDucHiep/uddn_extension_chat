import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getBffUrl, setBffUrl } from '@/lib/apiClient'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import { SettingsSection } from './SettingsControls'

/**
 * Section endpoint BFF (FR-SETTINGS-05 — T-M1-12, dich UI T-M1-17).
 *
 * AC: "validate endpoint khi luu" → goi `GET <url>/api/health` truoc khi
 * ghi. Khong dung `fetchJson` cua `apiClient` vi no luon doc URL tu storage
 * → can fetch truc tiep voi URL user dang nhap.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */
export interface EndpointSettingsProps {
  /** Endpoint BFF hien tai. */
  bffUrl: string
  /** Luu endpoint moi (da validate). */
  onSave: (bffUrl: string) => Promise<void>
  /** Hien thi thong bao thanh cong. */
  onSuccess: (message: string) => void
  /** Hien thi thong bao loi. */
  onError: (message: string) => void
}

/** Trai doi tuong luong: chi kiem tra duong dan HTTP(S). */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Section endpoint BFF.
 *
 * @param props - Props cua section.
 */
export function EndpointSettings({ bffUrl, onSave, onSuccess, onError }: EndpointSettingsProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(bffUrl)
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckAndSave = async (): Promise<void> => {
    const candidate = draft.trim().replace(/\/$/, '')

    if (!isHttpUrl(candidate)) {
      onError(t('toast.serverUrlInvalid'))
      return
    }

    setIsChecking(true)
    try {
      const response = await fetch(`${candidate}/api/health`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        onError(t('toast.serverUnreachable', { status: response.status }))
        return
      }

      // Luu ca endpoint BFF ( dung cho apiClient) va trong settings.
      await setBffUrl(candidate)
      await onSave(candidate)
      setDraft(candidate)
      onSuccess(t('toast.serverSaved'))
    } catch {
      onError(t('toast.serverUnreachableGeneric'))
    } finally {
      setIsChecking(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    const fallback = await getBffUrl()
    setDraft(fallback)
  }

  return (
    <SettingsSection title={t('settings.server.title')} description={t('settings.server.description')}>
      <div className="space-y-2 px-2">
        <label
          htmlFor="settings-bff-url"
          className="block text-[length:var(--font-size-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]"
        >
          {t('settings.server.endpointLabel')}
        </label>
        <Input
          id="settings-bff-url"
          type="url"
          inputMode="url"
          value={draft}
          placeholder="http://127.0.0.1:8787"
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          data-testid="settings-bff-url"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void handleCheckAndSave()
            }}
            disabled={isChecking}
            data-testid="settings-bff-check"
          >
            {isChecking ? t('settings.server.checking') : t('settings.server.checkSave')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              void handleReset()
            }}
            data-testid="settings-bff-reset"
          >
            {t('settings.server.reset')}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
