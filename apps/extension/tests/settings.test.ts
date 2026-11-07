import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SETTINGS,
  densityScaleFor,
  exportSettings,
  fontScaleFor,
  importSettings,
  panelMaxWidthFor,
  readSettings,
  resetSettings,
  resolveTheme,
  SETTINGS_STORAGE_KEY,
  writeSettings,
} from '../src/lib/settings'

/**
 * Unit test cho lop luu cai dat (FR-SETTINGS-01..07 — T-M1-12).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

/** Xoa het storage giữa cac test. */
async function clearStorage(): Promise<void> {
  await chrome.storage.local.get(null)
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all))
}

describe('readSettings', () => {
  beforeEach(async () => {
    await clearStorage()
  })

  it('tra ve mac dinh khi storage rong', async () => {
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('tra ve mac dinh khi gia tri khong phai object', async () => {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: 'khong-hop-le' })
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })

  it('tra ve mac dinh khi storage nem loi', async () => {
    const spy = vi
      .spyOn(chrome.storage.local, 'get')
      .mockRejectedValueOnce(new Error('storage loi') as never)
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS)
    spy.mockRestore()
  })

  it('giu field hop le va fallback field sai', async () => {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: { theme: 'dark', density: 'khong-hop-le' },
    })
    const result = await readSettings()
    expect(result.theme).toBe('dark')
    expect(result.density).toBe(DEFAULT_SETTINGS.density)
    expect(result.fontScale).toBe(DEFAULT_SETTINGS.fontScale)
  })

  it('mac dinh telemetry/history OFF (FR-SETTINGS-04)', () => {
    expect(DEFAULT_SETTINGS.telemetryEnabled).toBe(false)
    expect(DEFAULT_SETTINGS.historyEnabled).toBe(false)
  })
})

describe('writeSettings', () => {
  beforeEach(async () => {
    await clearStorage()
  })

  it('merge patch vao cai dat hien tai', async () => {
    await writeSettings({ theme: 'dark' })
    await writeSettings({ fontScale: 1.2 })

    const result = await readSettings()
    expect(result.theme).toBe('dark')
    expect(result.fontScale).toBe(1.2)
  })

  it('bo qua field khong hop le schema', async () => {
    await writeSettings({ theme: 'dark' })
    await writeSettings({ theme: 'xanh-neon' as never })

    const result = await readSettings()
    expect(result.theme).toBe('dark')
  })

  it('khong nem loi khi storage set that bai', async () => {
    const spy = vi
      .spyOn(chrome.storage.local, 'set')
      .mockRejectedValueOnce(new Error('set loi') as never)
    await expect(writeSettings({ theme: 'dark' })).resolves.toBeUndefined()
    spy.mockRestore()
  })
})

describe('resetSettings', () => {
  it('khoi phuc mac dinh', async () => {
    await writeSettings({ theme: 'dark', fontScale: 1.2 })
    await resetSettings()
    await expect(readSettings()).resolves.toEqual(DEFAULT_SETTINGS)
  })
})

describe('resolveTheme', () => {
  it('light → light', () => {
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('dark → dark', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('system → theo prefersDark', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('fontScaleFor', () => {
  it('tra ve gia tri hop le', () => {
    expect(fontScaleFor(0.9)).toBe('0.9')
    expect(fontScaleFor(1)).toBe('1')
    expect(fontScaleFor(1.1)).toBe('1.1')
    expect(fontScaleFor(1.2)).toBe('1.2')
  })

  it('fallback 1 cho gia tri ngoai danh sach', () => {
    expect(fontScaleFor(1.37)).toBe('1')
    expect(fontScaleFor(0)).toBe('1')
  })
})

describe('panelMaxWidthFor', () => {
  it('map dung 3 be rong', () => {
    expect(panelMaxWidthFor('narrow')).toBe('400px')
    expect(panelMaxWidthFor('default')).toBe('640px')
    expect(panelMaxWidthFor('wide')).toBe('960px')
  })
})

describe('densityScaleFor', () => {
  it('map dung 3 do mat', () => {
    expect(densityScaleFor('compact')).toBe('0.85')
    expect(densityScaleFor('cozy')).toBe('1')
    expect(densityScaleFor('comfortable')).toBe('1.15')
  })
})

describe('exportSettings', () => {
  beforeEach(async () => {
    await clearStorage()
  })

  it('xuat ra JSON hop le', async () => {
    await writeSettings({ theme: 'dark' })
    const json = await exportSettings()
    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(parsed['theme']).toBe('dark')
    expect(parsed['fontScale']).toBe(1)
  })
})

describe('importSettings', () => {
  beforeEach(async () => {
    await clearStorage()
  })

  it('nem loi voi JSON khong hop le', async () => {
    await expect(importSettings('{khong phai json')).rejects.toThrow(/JSON/)
  })

  it('nem loi voi JSON khong phai object', async () => {
    await expect(importSettings('123')).rejects.toThrow()
  })

  it('nem loi voi gia tri khong hop le schema', async () => {
    await expect(
      importSettings(JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'xanh-neon' })),
    ).rejects.toThrow()
  })

  it('nhap thanh cong va ghi vao storage', async () => {
    const result = await importSettings(
      JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'light', fontScale: 1.1 }),
    )
    expect(result.theme).toBe('light')
    await expect(readSettings()).resolves.toMatchObject({ theme: 'light', fontScale: 1.1 })
  })

  it('fill field thieu bang mac dinh', async () => {
    const result = await importSettings(JSON.stringify({ theme: 'dark' }))
    expect(result.theme).toBe('dark')
    expect(result.density).toBe(DEFAULT_SETTINGS.density)
  })
})
