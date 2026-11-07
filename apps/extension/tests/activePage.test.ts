import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readActivePage } from '../src/lib/activePage'
import { tabsQueryMock } from './setup'

/**
 * Unit test cho `readActivePage` (T-M1-11).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.12
 */

beforeEach(() => {
  vi.clearAllMocks()
})

describe('readActivePage', () => {
  it('tra url + tieu de cua tab active', async () => {
    tabsQueryMock.mockResolvedValue([
      { id: 1, url: 'https://example.com/a', title: 'Trang A', active: true },
    ] as chrome.tabs.Tab[])

    const page = await readActivePage()

    expect(page).toEqual({ url: 'https://example.com/a', title: 'Trang A' })
  })

  it('tra undefined khi khong co tab nao', async () => {
    tabsQueryMock.mockResolvedValue([])

    expect(await readActivePage()).toBeUndefined()
  })

  it('khong throw khi chrome.tabs.query loi', async () => {
    tabsQueryMock.mockRejectedValue(new Error('no tabs permission'))

    expect(await readActivePage()).toBeUndefined()
  })

  it('tra undefined khi tab khong co url', async () => {
    tabsQueryMock.mockResolvedValue([
      { id: 1, title: 'Khong co URL', active: true },
    ] as chrome.tabs.Tab[])

    expect(await readActivePage()).toBeUndefined()
  })

  it('tieu de rong → tra chuoi rong (khong undefined)', async () => {
    tabsQueryMock.mockResolvedValue([
      { id: 1, url: 'https://example.com/', active: true },
    ] as chrome.tabs.Tab[])

    const page = await readActivePage()

    expect(page).toEqual({ url: 'https://example.com/', title: '' })
  })
})
