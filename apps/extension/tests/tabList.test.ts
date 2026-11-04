import { describe, expect, it, vi, beforeEach } from 'vitest'
import { domainOf, listOpenTabs } from '../src/lib/tabList.js'

/**
 * Unit test cho `tabList` — danh sach tab cho popover `@` (T-M1-05).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3
 */

const queryMock = vi.fn()

/** Mock `chrome.tabs.query` tra ve danh sach tab cho truoc. */
function mockTabs(tabs: unknown[]): void {
  queryMock.mockResolvedValue(tabs)
}

beforeEach(() => {
  queryMock.mockReset()
  mockTabs([])
  vi.stubGlobal('chrome', {
    tabs: { query: queryMock },
  })
})

describe('listOpenTabs', () => {
  it('tra ve danh sach tab co id, tieu de, url, domain', async () => {
    mockTabs([
      { id: 1, title: 'Bai viet mau', url: 'https://example.com/bai-viet', active: true },
    ])

    const tabs = await listOpenTabs()

    expect(tabs).toHaveLength(1)
    expect(tabs[0]?.id).toBe(1)
    expect(tabs[0]?.title).toBe('Bai viet mau')
    expect(tabs[0]?.url).toBe('https://example.com/bai-viet')
    expect(tabs[0]?.domain).toBe('example.com')
    expect(tabs[0]?.active).toBe(true)
  })

  it('loai bo trang dac biet cua trinh duyet (chrome://, file://)', async () => {
    mockTabs([
      { id: 1, title: 'Trang web', url: 'https://example.com/' },
      { id: 2, title: 'Extensions', url: 'chrome://extensions' },
      { id: 3, title: 'File local', url: 'file:///C:/tai-lieu.pdf' },
      { id: 4, title: 'Settings', url: 'chrome-extension://abc/options.html' },
    ])

    const tabs = await listOpenTabs()

    expect(tabs.map((tab) => tab.id)).toEqual([1])
  })

  it('bo qua tab khong co id hoac khong co url', async () => {
    mockTabs([
      { title: 'Khong id', url: 'https://example.com/a' },
      { id: 2, title: 'Khong url', url: '' },
      { id: 3, title: 'Hop le', url: 'https://example.com/b' },
    ])

    const tabs = await listOpenTabs()

    expect(tabs.map((tab) => tab.id)).toEqual([3])
  })

  it('dung tieu de tab khi trang chua co ten → fallback sang url', async () => {
    mockTabs([{ id: 1, title: '', url: 'https://example.com/khong-tieu-de' }])

    const tabs = await listOpenTabs()

    expect(tabs[0]?.title).toBe('https://example.com/khong-tieu-de')
  })

  it('gioi han so tab tra ve theo limit', async () => {
    mockTabs(
      Array.from({ length: 30 }, (_value, index) => ({
        id: index + 1,
        title: `Tab ${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
    )

    const tabs = await listOpenTabs(5)

    expect(tabs).toHaveLength(5)
    expect(tabs[0]?.id).toBe(1)
    expect(tabs[4]?.id).toBe(5)
  })

  it('khong throw khi chrome.tabs.query that bai → tra ve mang rong', async () => {
    queryMock.mockRejectedValue(new Error('no permission'))

    const tabs = await listOpenTabs()

    expect(tabs).toEqual([])
  })

  it('chi query tab trong cua so hien tai', async () => {
    mockTabs([])

    await listOpenTabs()

    expect(queryMock).toHaveBeenCalledWith({ currentWindow: true })
  })

  it('giu favIconUrl neu co', async () => {
    mockTabs([
      {
        id: 1,
        title: 'Co favicon',
        url: 'https://example.com/',
        favIconUrl: 'https://example.com/favicon.ico',
      },
    ])

    const tabs = await listOpenTabs()

    expect(tabs[0]?.favIconUrl).toBe('https://example.com/favicon.ico')
  })
})

describe('domainOf', () => {
  it('lay domain va bo www.', () => {
    expect(domainOf('https://www.example.com/bai-viet')).toBe('example.com')
  })

  it('giu subdomain', () => {
    expect(domainOf('https://docs.example.com/x')).toBe('docs.example.com')
  })

  it('tra chuoi rong khi url khong parse duoc', () => {
    expect(domainOf('khong phai url')).toBe('')
  })
})
