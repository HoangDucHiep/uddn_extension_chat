import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Unit test cho `contextAttach` — tao context item tu tab dang active.
 * Docs: docs/SYSTEM_DESIGN.md §3 (lib/contextAttach.ts)
 */

const captureTabContextMock = vi.fn()
const getActiveTabIdMock = vi.fn()

vi.mock('@/lib/pageContext', () => ({
  captureTabContext: (tabId: number) => captureTabContextMock(tabId),
  getActiveTabId: () => getActiveTabIdMock(),
}))

const { attachCurrentTab, tabItemId } = await import('../src/lib/contextAttach')

beforeEach(() => {
  captureTabContextMock.mockReset()
  getActiveTabIdMock.mockReset()
  getActiveTabIdMock.mockResolvedValue(undefined)
})

describe('attachCurrentTab', () => {
  it('tao item tier attachment tu tab dang active', async () => {
    getActiveTabIdMock.mockResolvedValue(42)
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Tieu de bai viet',
      tabId: 42,
      text: 'Noi dung chinh cua trang.',
      excerpt: 'Noi dung chinh cua trang.',
      sourceKind: 'html',
    })

    const result = await attachCurrentTab()

    expect(result.item).toBeDefined()
    expect(result.item?.kind).toBe('tab')
    expect(result.item?.tier).toBe('attachment')
    expect(result.item?.url).toBe('https://example.com/bai-viet')
    expect(result.item?.title).toBe('Tieu de bai viet')
    expect(result.item?.text).toBe('Noi dung chinh cua trang.')
    expect(result.item?.tabId).toBe(42)
    expect(result.error).toBeUndefined()
  })

  it('khong tao item khi khong co tab active', async () => {
    getActiveTabIdMock.mockResolvedValue(undefined)

    const result = await attachCurrentTab()

    expect(result.item).toBeUndefined()
    expect(captureTabContextMock).not.toHaveBeenCalled()
  })

  it('khong tao item khi trang rong (khong co url/title)', async () => {
    getActiveTabIdMock.mockResolvedValue(7)
    captureTabContextMock.mockResolvedValue({
      url: '',
      title: '',
      tabId: 7,
    })

    const result = await attachCurrentTab()

    expect(result.item).toBeUndefined()
  })

  it('tra loi trich xuat ma khong throw (PDF scan)', async () => {
    getActiveTabIdMock.mockResolvedValue(9)
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/file.pdf',
      title: 'file.pdf',
      tabId: 9,
      sourceKind: 'pdf',
      contextError: 'CONTEXT_PDF_NOT_READABLE',
      contextErrorMessage: 'PDF khong co text layer.',
    })

    const result = await attachCurrentTab()

    expect(result.error).toBe('CONTEXT_PDF_NOT_READABLE')
    expect(result.errorMessage).toBe('PDF khong co text layer.')
    expect(result.sourceKind).toBe('pdf')
    // Van tao item de nguoi dung biet trang nao dang bi loi.
    expect(result.item).toBeDefined()
    expect(result.item?.tier).toBe('attachment')
  })

  it('khong throw khi capture that bai', async () => {
    getActiveTabIdMock.mockResolvedValue(11)
    captureTabContextMock.mockRejectedValue(new Error('boom'))

    const result = await attachCurrentTab()

    expect(result.item).toBeUndefined()
    expect(result.error).toBeUndefined()
  })

  it('tra ve item da dinh kem khi attach lai cung tab (khong capture lai)', async () => {
    getActiveTabIdMock.mockResolvedValue(42)

    const result = await attachCurrentTab([
      {
        id: 'tab-42',
        kind: 'tab',
        tier: 'attachment',
        title: 'Bai viet',
        tabId: 42,
      },
    ])

    expect(result.item?.id).toBe('tab-42')
    expect(captureTabContextMock).not.toHaveBeenCalled()
  })
})

describe('tabItemId', () => {
  it('sinh id dinh danh theo tabId', () => {
    expect(tabItemId(42)).toBe('tab-42')
  })
})
