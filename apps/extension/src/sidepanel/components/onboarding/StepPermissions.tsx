import { useState } from 'react'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
  /** Giai thich ngan bang tieng Viet. */
  reason: string
}

/** Danh sach quyen cua Sidekick AI. */
const PERMISSIONS: PermissionItem[] = [
  {
    name: 'sidePanel',
    reason: 'Hien thi khung tro chuyen ben canh trang web.',
  },
  {
    name: 'scripting',
    reason: 'Doc noi dung trang web khi ban dinh kem tab vao cua hoi.',
  },
  {
    name: 'tabs',
    reason: 'Biet tab dang mo de dinh kem nguyen canh dung.',
  },
  {
    name: 'storage',
    reason: 'Luu cai dat, khoa API key va lich su cua ban tren may nay.',
  },
  {
    name: 'contextMenus',
    reason: 'Them muc "Hoi Sidekick" khi ban chon mot doan van ban.',
  },
  {
    name: '<all_urls>',
    reason: 'Doc noi dung cua trang web ban muon hoi ve.',
  },
]

export interface StepPermissionsProps {
  /** Chuyen sang buoc sau. */
  onNext: () => void
}

export function StepPermissions({ onNext }: StepPermissionsProps) {
  const [extensionId, setExtensionId] = useState<string | undefined>(undefined)

  /**
   * Mo trang chi tiet extension trong `chrome://extensions`.
   *
   * `chrome.tabs.create` **tu choi** mo URL `chrome://` (promise reject) →
   * bọc try/catch va fallback hien extension id de user tu mo.
   */
  const handleOpenSettings = async (): Promise<void> => {
    let id: string
    try {
      id = chrome.runtime.id
    } catch {
      id = ''
    }

    if (id.length === 0) {
      setExtensionId('Khong lay duoc extension id')
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
            Sidekick AI can mot so quyen
          </h2>
          <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--text-secondary)]">
            Cac quyen duoc xin luc cai dat va chi dung de lam cac chuc nang duoi day. Ban
            co the xem lai va bat/tat trong trang cai dat trinh duyet.
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
              {permission.reason}
            </p>
          </li>
        ))}
      </ul>

      {extensionId !== undefined && (
        <p
          className="rounded-[var(--radius-md)] bg-[var(--warning-subtle)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--font-size-sm)] text-[var(--text-secondary)]"
          data-testid="onboarding-extension-id"
        >
          Mo trinh duyet va vao <code>chrome://extensions</code> de xem chi tiet. Extension
          id: <code>{extensionId}</code>
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
          Mo cai dat trinh duyet
        </Button>
        <Button onClick={onNext} data-testid="onboarding-next">
          Tiep tuc
        </Button>
      </div>
    </section>
  )
}
