import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CitationChip } from '../src/sidepanel/components/chat/CitationChip.js'
import { CitationList } from '../src/sidepanel/components/chat/CitationList.js'
import { domainOf } from '../src/sidepanel/components/chat/CitationPopover.js'
import { tabsCreateMock } from './setup.js'

/**
 * Unit test cho chip trich dan + popover (FR-CONTEXT-10 — T-M1-08).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.9
 */

const citation = {
  index: 1,
  url: 'https://example.com/bai-viet',
  title: 'Bai viet ve Sidekick',
  snippet: 'Doan trich dan ngan cua bai viet.',
  tabId: 7,
}

describe('CitationChip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('chip co metadata → render nut co aria-label', () => {
    render(<CitationChip index={1} citation={citation} />)

    const chip = screen.getByTestId('citation-chip-1')
    expect(chip.tagName).toBe('BUTTON')
    expect(chip.getAttribute('aria-label')).toContain('Xem nguồn 1')
    expect(chip.textContent).toBe('[1]')
  })

  it('chip KHONG co metadata → render span (khong co popover)', () => {
    render(<CitationChip index={2} citation={undefined} />)

    const chip = screen.getByTestId('citation-chip-2')
    expect(chip.tagName).toBe('SPAN')
    expect(chip.textContent).toBe('[2]')
  })

  it('click chip → mo popover hien thi tieu de + domain + snippet', async () => {
    render(<CitationChip index={1} citation={citation} />)

    fireEvent.click(screen.getByTestId('citation-chip-1'))

    await waitFor(() => {
      expect(screen.getByTestId('citation-popover-1')).toBeDefined()
    })
    expect(screen.getByTestId('citation-title').textContent).toBe('Bai viet ve Sidekick')
    expect(screen.getByTestId('citation-domain').textContent).toBe('example.com')
    expect(screen.getByTestId('citation-snippet').textContent).toBe(
      'Doan trich dan ngan cua bai viet.',
    )
  })

  it('nut "Mo trang goc" → goi chrome.tabs.create dung URL', async () => {
    tabsCreateMock.mockResolvedValueOnce({ id: 1 } as chrome.tabs.Tab)
    render(<CitationChip index={1} citation={citation} />)

    fireEvent.click(screen.getByTestId('citation-chip-1'))

    await waitFor(() => {
      expect(screen.getByTestId('citation-open-source')).toBeDefined()
    })
    fireEvent.click(screen.getByTestId('citation-open-source'))

    await waitFor(() => {
      expect(tabsCreateMock).toHaveBeenCalledWith({ url: 'https://example.com/bai-viet' })
    })
  })

  it('nguon khong co URL → nut "Mo trang goc" bi disable', async () => {
    render(<CitationChip index={1} citation={{ ...citation, url: '' }} />)

    fireEvent.click(screen.getByTestId('citation-chip-1'))

    await waitFor(() => {
      expect(screen.getByTestId('citation-open-source')).toBeDefined()
    })
    expect((screen.getByTestId('citation-open-source') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('CitationList', () => {
  it('render danh sach nguon trich dan', () => {
    render(
      <CitationList
        citations={[
          citation,
          { index: 2, url: 'https://blog.example.org/bai-2', title: 'Bai 2', snippet: 'x' },
        ]}
      />,
    )

    expect(screen.getByTestId('citation-list')).toBeDefined()
    expect(screen.getByTestId('citation-index-1').textContent).toBe('1')
    expect(screen.getByTestId('citation-index-2').textContent).toBe('2')
    expect(screen.getByTestId('citation-source-1').textContent).toBe('example.com')
  })

  it('khong co nguon → khong render gi', () => {
    const { container } = render(<CitationList citations={[]} />)

    expect(container.innerHTML).toBe('')
  })
})

describe('domainOf', () => {
  it('bo "www." khoi domain', () => {
    expect(domainOf('https://www.example.com/x')).toBe('example.com')
  })

  it('URL khong hop le → chuoi rong', () => {
    expect(domainOf('khong phai url')).toBe('')
  })
})
