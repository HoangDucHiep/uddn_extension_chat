import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const deleteAllConversationsMock = vi.fn(async () => 2)

vi.mock('@/lib/conversationClient', () => ({
  deleteAllConversations: () => deleteAllConversationsMock(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const { SettingsDrawer } = await import('../src/sidepanel/components/settings/SettingsDrawer')
const { readSettings, SETTINGS_STORAGE_KEY } = await import('../src/lib/settings')

/**
 * Unit test cho drawer cai dat (FR-SETTINGS-01..07 — T-M1-12).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14 · docs/DESIGN_SYSTEM_BRIEF.md §3.7
 */

/** Xoa het storage giữa cac test. */
async function clearStorage(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  await chrome.storage.local.remove(Object.keys(all))
}

/** Doc storage local raw. */
async function readRaw(): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(null)
}

describe('SettingsDrawer', () => {
  beforeEach(async () => {
    await clearStorage()
    document.documentElement.className = ''
    document.documentElement.removeAttribute('style')
    deleteAllConversationsMock.mockClear()
  })

  it('render drawer khi mo', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    expect(await screen.findByTestId('settings-drawer')).toBeTruthy()
  })

  it('hien thi 6 section cai dat', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    expect(await screen.findByText('Giao diện')).toBeTruthy()
    expect(screen.getByText('Hiển thị')).toBeTruthy()
    expect(screen.getByText('Quyền riêng tư')).toBeTruthy()
    expect(screen.getByText('Quản lý dữ liệu')).toBeTruthy()
    expect(screen.getByText('Máy chủ (BFF)')).toBeTruthy()
    expect(screen.getAllByText('Ngôn ngữ').length).toBeGreaterThan(0)
  })

  it('doi theme → toggle class .dark tren html + luu vao storage', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    const darkRadio = await screen.findByTestId('radio-dark')
    fireEvent.click(darkRadio)

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    await waitFor(async () => {
      const raw = await readRaw()
      const stored = raw[SETTINGS_STORAGE_KEY] as Record<string, unknown> | undefined
      expect(stored?.['theme']).toBe('dark')
    })
  })

  it('doi co chu → set --font-scale + luu vao storage', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    const bigRadio = await screen.findByTestId('radio-1.2')
    fireEvent.click(bigRadio)

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.2')
    })

    await waitFor(async () => {
      const raw = await readRaw()
      const stored = raw[SETTINGS_STORAGE_KEY] as Record<string, unknown> | undefined
      expect(stored?.['fontScale']).toBe(1.2)
    })
  })

  it('doi be rong panel → set --panel-max-width', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    const wideRadio = await screen.findByTestId('radio-wide')
    fireEvent.click(wideRadio)

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--panel-max-width')).toBe('960px')
    })
  })

  it('bat toggle quyen rieng tu → luu vao storage', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    const toggle = await screen.findByTestId('settings-telemetry')
    fireEvent.click(toggle)

    await waitFor(async () => {
      const raw = await readRaw()
      const stored = raw[SETTINGS_STORAGE_KEY] as Record<string, unknown> | undefined
      expect(stored?.['telemetryEnabled']).toBe(true)
    })
  })

  it('bam nut xoa lich su → mo confirm dialog', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    const button = await screen.findByTestId('settings-delete-history')
    fireEvent.click(button)

    expect(await screen.findByTestId('confirm-dialog')).toBeTruthy()
    expect(screen.getByText('Xoá toàn bộ lịch sử chat?')).toBeTruthy()
  })

  it('xac nhan xoa lich su → goi DELETE /api/conversations', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    fireEvent.click(await screen.findByTestId('settings-delete-history'))
    const accept = await screen.findByTestId('confirm-accept')
    fireEvent.click(accept)

    await waitFor(() => {
      expect(deleteAllConversationsMock).toHaveBeenCalledTimes(1)
    })
  })

  it('cai dat doc lai duoc sau khi storage doi o noi khac', async () => {
    render(<SettingsDrawer open onOpenChange={() => undefined} />)
    await screen.findByTestId('settings-drawer')

    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: {
        theme: 'dark',
        fontScale: 1,
        density: 'cozy',
        panelWidth: 'default',
        telemetryEnabled: false,
        historyEnabled: false,
        uiLanguage: 'vi',
        bffUrl: 'http://127.0.0.1:8787',
      },
    })

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  it('docSettings tra mac dinh khi storage rong', async () => {
    await expect(readSettings()).resolves.toMatchObject({ theme: 'system' })
  })
})
