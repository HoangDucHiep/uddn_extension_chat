import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ModelPicker } from '../src/sidepanel/components/ModelPicker.js'
import { MODEL_SELECTION_STORAGE_KEY } from '../src/lib/modelSelection.js'

/**
 * Unit test cho model picker (T-M2-02 — FR-PROVIDER-03).
 *
 * Kiem chung:
 *  - Mo picker → tai danh sach provider + model.
 *  - Chon model → luu vao `chrome.storage.local`.
 *  - Danh sach fallback → hien canh bao.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.22
 */

const listProvidersMock = vi.fn(async () => [
  {
    id: 'mock' as const,
    name: 'Mock Provider',
    models: ['mock-model'],
    keySource: 'none',
    requiresKey: false,
    available: true,
  },
  {
    id: 'groq' as const,
    name: 'Groq',
    models: ['openai/gpt-oss-120b'],
    keySource: 'none',
    requiresKey: true,
    available: false,
  },
])

const listProviderModelsMock = vi.fn(async (providerId: string) => ({
  providerId: providerId as never,
  models: ['mock-model', 'mock-model-fast'],
  source: 'live' as const,
}))

vi.mock('@/lib/providerClient', () => ({
  listProviders: () => listProvidersMock(),
  listProviderModels: (providerId: string) => listProviderModelsMock(providerId),
}))

describe('ModelPicker', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const all = await chrome.storage.local.get(null)
    await chrome.storage.local.remove(Object.keys(all))
  })

  it('render nut mo picker', () => {
    render(<ModelPicker />)

    expect(screen.getByTestId('model-picker-button')).toBeTruthy()
  })

  it('mo picker → tai danh sach provider va model', async () => {
    render(<ModelPicker />)

    fireEvent.click(screen.getByTestId('model-picker-button'))

    await waitFor(() => {
      expect(screen.getByTestId('model-picker')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByTestId('model-picker-provider-mock')).toBeTruthy()
    })
    await waitFor(() => {
      expect(screen.getByTestId('model-picker-model-mock-model')).toBeTruthy()
    })
  })

  it('chi hien thi provider dang `available`', async () => {
    render(<ModelPicker />)

    fireEvent.click(screen.getByTestId('model-picker-button'))

    await waitFor(() => {
      expect(screen.getByTestId('model-picker-provider-mock')).toBeTruthy()
    })
    expect(screen.queryByTestId('model-picker-provider-groq')).toBeNull()
  })

  it('chon model → luu vao chrome.storage.local', async () => {
    render(<ModelPicker />)

    fireEvent.click(screen.getByTestId('model-picker-button'))

    await waitFor(() => {
      expect(screen.getByTestId('model-picker-model-mock-model-fast')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('model-picker-model-mock-model-fast'))

    await waitFor(async () => {
      const raw = await chrome.storage.local.get(MODEL_SELECTION_STORAGE_KEY)
      const saved = raw[MODEL_SELECTION_STORAGE_KEY] as
        | { providerId?: string | null; model?: string | null }
        | undefined
      expect(saved?.providerId).toBe('mock')
      expect(saved?.model).toBe('mock-model-fast')
    })
  })

  it('danh sach fallback → hien canh bao "co the cu"', async () => {
    listProviderModelsMock.mockResolvedValueOnce({
      providerId: 'mock' as never,
      models: ['mock-model'],
      source: 'fallback',
    })

    render(<ModelPicker />)

    fireEvent.click(screen.getByTestId('model-picker-button'))

    await waitFor(() => {
      expect(screen.getByTestId('model-picker-fallback-notice')).toBeTruthy()
    })
  })

  it('bam "Ve mac dinh" → xoa lua chon', async () => {
    await chrome.storage.local.set({
      [MODEL_SELECTION_STORAGE_KEY]: { providerId: 'mock', model: 'mock-model' },
    })

    render(<ModelPicker />)

    fireEvent.click(screen.getByTestId('model-picker-button'))

    await waitFor(() => {
      expect(screen.getByTestId('model-picker-reset')).toBeTruthy()
    })
    fireEvent.click(screen.getByTestId('model-picker-reset'))

    await waitFor(async () => {
      const raw = await chrome.storage.local.get(MODEL_SELECTION_STORAGE_KEY)
      const saved = raw[MODEL_SELECTION_STORAGE_KEY] as
        | { providerId?: string | null }
        | undefined
      expect(saved?.providerId).toBeNull()
    })
  })
})
