import { useCallback, useEffect, useState } from 'react'
import type { Settings } from '@sidekick/shared'
import { readSettings, DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, writeSettings } from '@/lib/settings'
import {
  applyDensity,
  applyFontScale,
  applyPanelWidth,
  applyTheme,
  prefersDarkScheme,
  watchSystemTheme,
} from '@/lib/theme'

/**
 * Hook `useSettings` — quan ly cai dat nguoi dung (FR-SETTINGS-01..07 — T-M1-12).
 *
 * - Doc tu `chrome.storage.local` (key `sidekick.settings`).
 * - Lang nghe `chrome.storage.onChanged` → dong bo khi doi o noi khac.
 * - **Ap dung ngay** (khong reload): theme / font-scale / do mat / be rong
 *   deu duoc day vao CSS variable tren `<html>`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */
export interface UseSettingsResult {
  /** Cai dat hien tai. */
  settings: Settings
  /** Dang doc cai dat tu storage. */
  isLoading: boolean
  /** Cap nhat mot phan cai dat → luu ngay + ap dung ngay. */
  update: (patch: Partial<Settings>) => Promise<void>
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    const stored = await readSettings()
    setSettings(stored)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Storage thay doi o noi khac → dong bo lai.
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (areaName !== 'local') return
      if (!(SETTINGS_STORAGE_KEY in changes)) return
      void reload()
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [reload])

  // Ap dung ngay khi cai dat doi (AC FR-SETTINGS-01/02 — khong can reload).
  useEffect(() => {
    if (settings === undefined) return

    applyTheme(settings.theme, prefersDarkScheme())
    applyFontScale(settings.fontScale)
    applyDensity(settings.density)
    applyPanelWidth(settings.panelWidth)
  }, [settings])

  // Theme = `system` → OS doi nen toi → ap lai ngay.
  useEffect(() => {
    if (settings === undefined) return
    if (settings.theme !== 'system') return

    return watchSystemTheme((prefersDark) => {
      applyTheme('system', prefersDark)
    })
  }, [settings])

  const update = useCallback(async (patch: Partial<Settings>): Promise<void> => {
    // Cap nhat state ngay de UI phan hoi khong co delay (optimistic).
    setSettings((current) => (current === undefined ? current : { ...current, ...patch }))
    await writeSettings(patch)
  }, [])

  if (settings === undefined) {
    // Chua doc xong → tra placeholder de UI khong crash.
    return {
      settings: { ...DEFAULT_SETTINGS },
      isLoading,
      update,
    }
  }

  return { settings, isLoading, update }
}
