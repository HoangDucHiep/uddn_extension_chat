import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MentionPopover } from '../src/sidepanel/components/context/MentionPopover.js'
import type { OpenTab } from '../src/lib/tabList.js'

/**
 * Unit test cho `MentionPopover` — popover chon tab (T-M1-05).
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.4
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

describe('MentionPopover', () => {
  it('hien thi tieu de va domain cua moi tab', () => {
    render(
      <MentionPopover
        tabs={[tab({ id: 1 }), tab({ id: 2, title: 'Trang 2', domain: 'abc.com' })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Bai viet mau')).toBeDefined()
    expect(screen.getByText('example.com')).toBeDefined()
    expect(screen.getByText('Trang 2')).toBeDefined()
    expect(screen.getByText('abc.com')).toBeDefined()
  })

  it('goi onSelect voi tab duoc chon', () => {
    const onSelect = vi.fn()
    render(
      <MentionPopover
        tabs={[tab({ id: 7 })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByTestId('mention-tab'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 7 })
  })

  it('danh dau tab da dinh kem bang aria-selected', () => {
    render(
      <MentionPopover
        tabs={[tab({ id: 1 }), tab({ id: 2 })]}
        activeTabId={undefined}
        attachedTabIds={[2]}
        onSelect={vi.fn()}
      />,
    )

    const options = screen.getAllByRole('option')
    expect(options[0]?.getAttribute('aria-selected')).toBe('false')
    expect(options[1]?.getAttribute('aria-selected')).toBe('true')
  })

  it('hien thi thong bao khi danh sach rong', () => {
    render(
      <MentionPopover
        tabs={[]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByTestId('mention-popover').textContent).toContain('Không có tab')
  })

  it('hien thi trang thai dang tai khi loading', () => {
    render(
      <MentionPopover
        tabs={[]}
        activeTabId={undefined}
        attachedTabIds={[]}
        isLoading
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByTestId('mention-popover').textContent).toContain('Đang tải')
  })

  it('co role listbox va nhan aria-label', () => {
    render(
      <MentionPopover
        tabs={[tab()]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onSelect={vi.fn()}
      />,
    )

    const popover = screen.getByRole('listbox')
    expect(popover.getAttribute('aria-label')).toBe('Chọn tab để đính kèm')
  })

  it('hien thi favicon khi tab co favIconUrl', () => {
    const { container } = render(
      <MentionPopover
        tabs={[tab({ favIconUrl: 'https://example.com/favicon.ico' })]}
        activeTabId={undefined}
        attachedTabIds={[]}
        onSelect={vi.fn()}
      />,
    )

    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('https://example.com/favicon.ico')
  })
})
