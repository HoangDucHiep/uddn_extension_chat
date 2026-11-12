import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TabPicker } from '../src/sidepanel/components/context/TabPicker.js'
import type { OpenTab } from '../src/lib/tabList.js'

/**
 * Unit test cho `TabPicker` — chon **nhieu** tab mot luc (T-M3-POLISH).
 *
 * Kiem chung:
 *  - Tick/bot tick nhieu dong → danh sach chon dung.
 *  - Bam "Dinh kem" → `onAttachTabs` nhan **tat ca** id da chon.
 *  - Search loc danh sach theo tieu de / domain.
 *  - Tab da dinh kem truoc → tick san khi mo popover.
 *  - Chi bao "va N tab khac" khi danh sach bi cat boi `limit`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.31
 */

const tab = (overrides: Partial<OpenTab> = {}): OpenTab => ({
  id: 1,
  title: 'Bai viet mau',
  url: 'https://example.com/bai-viet',
  domain: 'example.com',
  favIconUrl: undefined,
  active: false,
  ...overrides,
})

/** Mo popover picker (popover Radix render qua portal). */
async function openPicker(): Promise<void> {
  fireEvent.click(screen.getByTestId('context-tab-picker-trigger'))
  await waitFor(() => {
    expect(screen.getByTestId('context-tab-picker')).toBeDefined()
  })
}

describe('TabPicker — chon nhieu tab', () => {
  it('mo popover va hien thi danh sach tab', async () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 }), tab({ id: 2, title: 'Trang 2', domain: 'abc.com' })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onAttachTabs={vi.fn()}
      />,
    )

    await openPicker()

    expect(screen.getAllByTestId('context-tab-picker-option')).toHaveLength(2)
    expect(screen.getByText('Bai viet mau')).toBeDefined()
    expect(screen.getByText('abc.com')).toBeDefined()
  })

  it('tick nhieu dong → bam "Dinh kem" → truyen tat ca id', async () => {
    const onAttachTabs = vi.fn()
    render(
      <TabPicker
        tabs={[tab({ id: 1 }), tab({ id: 2 }), tab({ id: 3 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onAttachTabs={onAttachTabs}
      />,
    )

    await openPicker()

    const options = screen.getAllByTestId('context-tab-picker-option')
    fireEvent.click(options[0]?.querySelector('input') as HTMLInputElement)
    fireEvent.click(options[2]?.querySelector('input') as HTMLInputElement)

    fireEvent.click(screen.getByTestId('context-tab-picker-attach'))

    expect(onAttachTabs).toHaveBeenCalledTimes(1)
    expect(onAttachTabs.mock.calls[0]?.[0]).toEqual([1, 3])
  })

  it('bot tick → tab bi loai khoi danh sach chon', async () => {
    const onAttachTabs = vi.fn()
    render(
      <TabPicker
        tabs={[tab({ id: 1 }), tab({ id: 2 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onAttachTabs={onAttachTabs}
      />,
    )

    await openPicker()

    const options = screen.getAllByTestId('context-tab-picker-option')
    const first = options[0]?.querySelector('input') as HTMLInputElement
    fireEvent.click(first)
    fireEvent.click(first)

    fireEvent.click(screen.getByTestId('context-tab-picker-attach'))

    expect(onAttachTabs).not.toHaveBeenCalled()
  })

  it('tab da dinh kem truoc → tick san khi mo popover', async () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 }), tab({ id: 2 })]}
        activeTabId={undefined}
        attachedTabIds={[2]}
        onAttachTabs={vi.fn()}
      />,
    )

    await openPicker()

    const options = screen.getAllByTestId('context-tab-picker-option')
    const second = options[1]?.querySelector('input') as HTMLInputElement
    expect(second.checked).toBe(true)
  })

  it('search loc danh sach theo tieu de', async () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 }), tab({ id: 2, title: 'Kubernetes' })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onAttachTabs={vi.fn()}
      />,
    )

    await openPicker()

    fireEvent.change(screen.getByTestId('context-tab-picker-search'), {
      target: { value: 'kube' },
    })

    const options = screen.getAllByTestId('context-tab-picker-option')
    expect(options).toHaveLength(1)
    expect(options[0]?.getAttribute('data-tab-id')).toBe('2')
  })

  it('chi bao "va N tab khac" khi danh sach bi cat boi limit', async () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        totalCount={12}
        onAttachTabs={vi.fn()}
      />,
    )

    await openPicker()

    expect(screen.getByTestId('context-tab-picker-more').textContent).toContain('11')
  })

  it('nut "Dinh kem" bi disable khi chua chon tab nao', async () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onAttachTabs={vi.fn()}
      />,
    )

    await openPicker()

    const attach = screen.getByTestId('context-tab-picker-attach') as HTMLButtonElement
    expect(attach.disabled).toBe(true)
  })

  it('badge tren trigger hien thi so tab da chon', () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        selectedCount={3}
        onAttachTabs={vi.fn()}
      />,
    )

    expect(screen.getByTestId('context-tab-picker-count').textContent).toBe('3')
  })

  it('controlled: parent mo picker qua prop `open`', async () => {
    render(
      <TabPicker
        tabs={[tab({ id: 1 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        open={true}
        onAttachTabs={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('context-tab-picker')).toBeDefined()
    })
  })
})
