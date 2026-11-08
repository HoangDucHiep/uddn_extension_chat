import { useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import type { TranslationKey } from '@/i18n'

/**
 * Buoc 1 cua onboarding — giai thich cac quyen extension dung (FR-UX-02).
 *
 * Quyet dinh scope: **chi giai thich**, khong doi manifest, khong xin quyen
 * runtime. Extension da co san quyen tinh khi cai dat → buoc nay giup user
 * hieu duoc minh bach.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6
 */

/** Mot quyen cua extension + ly do dung. */
interface PermissionItem {
  /** Ten quyen trong manifest. */
  name: string
  /** Key dich cho ly do dung. */
  reasonKey: TranslationKey
}

/** Danh sach quyen cua Sidekick AI. */
const PERMISSIONS: PermissionItem[] = [
  {
    name: 'sidePanel',
    reasonKey: 'onboarding.permissions.sidePanel',
  },
  {
    name: 'scripting',
    reasonKey: 'onboarding.permissions.tabRead',
  },
  {
    name: 'tabs',
    reasonKey: 'onboarding.permissions.tabs',
  },
  {
    name: 'storage',
    reasonKey: 'onboarding.permissions.storage',
  },
  {
    name: 'contextMenus',
    reasonKey: 'onboarding.permissions.contextMenus',
  },
  {
    name: '<all_urls>',
    reasonKey: 'onboarding.permissions.hostPermissions',
  },
]

export interface StepPermissionsProps {
  /** Chuyen sang buoc sau. */
  onNext: () => void
}

export function StepPermissions({ onNext }: StepPermissionsProps) {
  const { t } = useI18n()
  const [extensionId, setExtensionId] = useState<string | undefined>(undefined)

  /**
   * Mo trang chi tiet extension trong `chrome://extensions`.
   *
   * `chrome.tabs.create` **tu choi** mo URL `chrome://` (promise reject) →
   * boc try/catch va fallback hien extension id de user tu mo.
   */
  const handleOpenSettings = async (): Promise<void> => {
    let id: string
    try {
      id = chrome.runtime.id
    } catch {
      id = ''
    }

    if (id.length === 0) {
      setExtensionId(t('onboarding.permissions.extensionIdError'))
      return
    }

    try {
      await chrome.tabs.create({ url: `chrome://extensions/?id=${id}` })
    } catch {
      // Chrome chan URL `chrome://` tu extension → hien id de user copy.
      setExtensionId(id)
    }
  }

  return (
    <section className="flex flex-col gap-[var(--space-4)]" data-testid="onboarding-step-permissions">
      <header className="flex items-start gap-[var(--space-3)]">
        <ShieldCheck
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h2 className="text-[length:var(--font-size-lg)] font-semibold text-[var(--text-primary)]">
            {t('onboarding.permissions.title')}
          </h2>
          <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
            {t('onboarding.permissions.description')}
          </p>
        </div>
      </header>

      <ul className="flex flex-col gap-[var(--space-2)]">
        {PERMISSIONS.map((permission) => (
          <li
            key={permission.name}
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-[var(--space-3)] py-[var(--space-2)]"
          >
            <code className="text-[length:var(--font-size-sm)] font-medium text-[var(--text-primary)]">
              {permission.name}
            </code>
            <p className="mt-0.5 text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
              {t(permission.reasonKey)}
            </p>
          </li>
        ))}
      </ul>

      {extensionId !== undefined && (
        <p
          className="rounded-[var(--radius-md)] bg-[var(--warning-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
          data-testid="onboarding-extension-id"
        >
          {t('onboarding.permissions.openBrowserHint')}{' '}
          <code>{extensionId}</code>
        </p>
      )}

      <div className="flex flex-col gap-[var(--space-2)]">
        <Button
          variant="outline"
          onClick={() => {
            void handleOpenSettings()
          }}
          data-testid="onboarding-open-settings"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          {t('onboarding.permissions.openSettings')}
        </Button>
        <Button onClick={onNext} data-testid="onboarding-next">
          {t('onboarding.next')}
        </Button>
      </div>
    </section>
  )
}
