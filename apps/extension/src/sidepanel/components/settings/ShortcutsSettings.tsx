import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Keyboard, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { useI18n } from '@/sidepanel/hooks/useI18n'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_COMMANDS,
  formatShortcutLabel,
  parseShortcut,
  shortcutFromKeyboardEvent,
  type ShortcutCommandId,
} from '@/lib/shortcuts'
import {
  clearShortcut,
  readShortcuts,
  writeShortcut,
  type ShortcutMap,
} from '@/lib/shortcutStorage'
import { SettingsSection } from './SettingsControls'

/**
 * Section phim tat (FR-UX-01 — T-M1-18).
 *
 * ## 2 lop phim tat
 *
 * | Lop | Nguon luu | Cach doi | Pham vi |
 * |---|---|---|---|
 * | **Native Chrome** | Chrome tu quan ly | `chrome://extensions/shortcuts` | Toan trinh duyet (khi panel dong) |
 * | **Sidekick (nhanh)** | `chrome.storage.local` | Ngay trong Settings nay | Khi side panel dang focus |
 *
 * Ly do tach 2 lop: Chrome **khong** expose `chrome.commands.update()` /
 * `reset()` (do la API rieng cua **Firefox**) → `chrome.commands` chi doc
 * duoc bang `getAll()`. Shortcut **native** chi doi duoc o trang cai dat cua
 * trinh duyet → ta them nut "Mo trang phim tat" de nguoi dung tu do.
 *
 * Shortcut **nhanh** cua Sidekick la duong phu: bat o side panel → focus
 * o nhap ngay (khong can mo/close panel).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.18 · docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */

/** Trang cai dat phim tat cua Chrome. */
const CHROME_SHORTCUTS_URL = 'chrome://extensions/shortcuts'

/** Trang thai 1 command. */
interface CommandState {
  /** Shortcut **native** cua Chrome (doc tu `chrome.commands.getAll()`). */
  nativeShortcut: string
  /** Shortcut **nhanh** cua Sidekick (luu trong storage). */
  quickShortcut: string | undefined
}

/**
 * Section phim tat.
 */
export function ShortcutsSettings() {
  const { t } = useI18n()
  const [commands, setCommands] = useState<Record<string, CommandState>>({})
  const [editing, setEditing] = useState<ShortcutCommandId | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  /** Doc lai trang thai shortcut (native + nhanh). */
  const load = useCallback((): void => {
    if (typeof chrome === 'undefined' || chrome.commands === undefined) return

    chrome.commands.getAll((items) => {
      const nativeShortcuts: Record<string, string> = {}
      for (const item of items) {
        const name = item.name
        if (name === undefined) continue
        nativeShortcuts[name] = item.shortcut ?? ''
      }

      void readShortcuts().then((stored: ShortcutMap | undefined) => {
        const next: Record<string, CommandState> = {}
        for (const name of Object.keys(SHORTCUT_COMMANDS)) {
          next[name] = {
            nativeShortcut: nativeShortcuts[name] ?? '',
            quickShortcut: stored?.[name],
          }
        }
        setCommands(next)
      })
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /** Luu shortcut nhanh moi. */
  const applyQuickShortcut = useCallback(
    (name: ShortcutCommandId, shortcut: string): void => {
      void writeShortcut(name, shortcut).then(() => {
        setCommands((prev) => ({
          ...prev,
          [name]: { ...(prev[name] ?? { nativeShortcut: '' }), quickShortcut: shortcut },
        }))
        toast.success(t('settings.shortcuts.changed'))
      })
    },
    [t],
  )

  /** Xoa shortcut nhanh → quay ve mac dinh. */
  const resetQuickShortcut = useCallback(
    (name: ShortcutCommandId): void => {
      void clearShortcut(name).then(() => {
        setCommands((prev) => ({
          ...prev,
          [name]: { ...(prev[name] ?? { nativeShortcut: '' }), quickShortcut: undefined },
        }))
        toast.success(t('settings.shortcuts.resetDone'))
      })
    },
    [t],
  )

  /** Bam phim trong o "Doi" → validate → luu. */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, name: ShortcutCommandId): void => {
      if (event.key === 'Escape') {
        setEditing(undefined)
        setError(undefined)
        return
      }

      const raw = shortcutFromKeyboardEvent(event.nativeEvent)
      if (raw === undefined) return

      event.preventDefault()

      const parsed = parseShortcut(raw)
      if (!parsed.ok) {
        setError(
          parsed.reason === 'reserved'
            ? t('settings.shortcuts.reserved')
            : t('settings.shortcuts.invalid'),
        )
        return
      }

      applyQuickShortcut(name, parsed.shortcut)
      setEditing(undefined)
    },
    [applyQuickShortcut, t],
  )

  /** Mo trang cai dat phim tat cua Chrome. */
  const openChromeShortcuts = useCallback((): void => {
    void chrome.tabs.create({ url: CHROME_SHORTCUTS_URL })
  }, [])

  return (
    <SettingsSection
      title={t('settings.shortcuts.title')}
      description={t('settings.shortcuts.description')}
    >
      <div className="space-y-3" data-testid="settings-shortcuts">
        {(Object.keys(SHORTCUT_COMMANDS) as ShortcutCommandId[]).map((name) => {
          const state = commands[name]
          const native = formatShortcutLabel(state?.nativeShortcut)
          const quick = state?.quickShortcut ?? DEFAULT_SHORTCUTS[name]
          const isEditing = editing === name
          const isDefault = state?.quickShortcut === undefined

          return (
            <div
              key={name}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-2 py-2"
              data-testid={`shortcut-row-${name}`}
            >
              <p className="text-[length:var(--font-size-sm)] text-[var(--text-primary)]">
                {t(SHORTCUT_COMMANDS[name])}
              </p>

              {/* Lop 1 — shortcut native cua Chrome. */}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                    {t('settings.shortcuts.nativeLabel')}
                  </span>
                  <span
                    className="block font-mono text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
                    data-testid={`shortcut-native-${name}`}
                  >
                    {native ?? t('settings.shortcuts.notSet')}
                  </span>
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={openChromeShortcuts}
                  aria-label={t('settings.shortcuts.openChrome')}
                  data-testid={`shortcut-open-chrome-${name}`}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('settings.shortcuts.openChrome')}
                </Button>
              </div>

              {/* Lop 2 — shortcut nhanh cua Sidekick. */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--font-size-xs)] text-[var(--text-tertiary)]">
                    {t('settings.shortcuts.quickLabel')}
                  </span>
                  <span
                    className="block font-mono text-[length:var(--font-size-xs)] text-[var(--text-secondary)]"
                    data-testid={`shortcut-quick-${name}`}
                  >
                    {formatShortcutLabel(quick) ?? t('settings.shortcuts.notSet')}
                  </span>
                </span>

                {isEditing ? (
                  <button
                    type="button"
                    className="min-h-6 rounded-[var(--radius-sm)] border border-[var(--color-accent)] px-2 text-[length:var(--font-size-xs)] text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
                    onKeyDown={(event) => {
                      handleKeyDown(event, name)
                    }}
                    onBlur={() => {
                      setEditing(undefined)
                      setError(undefined)
                    }}
                    aria-label={t('settings.shortcuts.pressKeys')}
                    data-testid={`shortcut-capture-${name}`}
                    autoFocus
                  >
                    {t('settings.shortcuts.pressKeys')}
                  </button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(name)
                      setError(undefined)
                    }}
                    data-testid={`shortcut-change-${name}`}
                  >
                    <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('settings.shortcuts.change')}
                  </Button>
                )}

                <IconButton
                  size="sm"
                  disabled={isDefault}
                  onClick={() => {
                    resetQuickShortcut(name)
                  }}
                  aria-label={t('settings.shortcuts.reset')}
                  tooltip={t('settings.shortcuts.reset')}
                  data-testid={`shortcut-reset-${name}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                </IconButton>
              </div>
            </div>
          )
        })}

        {error !== undefined ? (
          <p
            className="text-[length:var(--font-size-xs)] text-[var(--danger)]"
            role="alert"
            data-testid="shortcut-error"
          >
            {error}
          </p>
        ) : null}
      </div>
    </SettingsSection>
  )
}
