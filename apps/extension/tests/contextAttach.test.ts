import { describe, expect, it, vi, beforeEach } from 'vitest'

const captureTabContextMock = vi.fn()
const getActiveTabIdMock = vi.fn()

vi.mock('@/lib/pageContext', () => ({
  captureTabContext: (tabId: number) => captureTabContextMock(tabId),
  getActiveTabId: () => getActiveTabIdMock(),
}))

const { attachCurrentTab, attachTab, attachSelection, captureActiveSelection, tabItemId } =
  await import('../src/lib/contextAttach.js')

/**
 * Unit test cho `contextAttach` — dinh kem tab vao context (T-M1-05).
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

beforeEach(() => {
  captureTabContextMock.mockReset()
  getActiveTabIdMock.mockReset()
  getActiveTabIdMock.mockResolvedValue(undefined)
})
describe('attachTab', () => {
  it('tao item context voi tier attachment cho tab bat ky', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet mau',
      tabId: 42,
      text: 'Noi dung chinh.',
      excerpt: 'Noi dung chinh.',
      sourceKind: 'html',
    })

    const result = await attachTab(42)

    expect(result.item).toBeDefined()
    expect(result.item?.id).toBe('tab-42')
    expect(result.item?.kind).toBe('tab')
    expect(result.item?.tier).toBe('attachment')
    expect(result.item?.tabId).toBe(42)
    expect(result.item?.url).toBe('https://example.com/bai-viet')
    expect(result.item?.title).toBe('Bai viet mau')
    expect(result.item?.text).toBe('Noi dung chinh.')
    expect(result.item?.sourceKind).toBe('html')
  })

  it('KHONG capture lai khi tab da duoc dinh kem', async () => {
    const existing = {
      id: 'tab-42',
      kind: 'tab' as const,
      tier: 'attachment' as const,
      url: 'https://example.com/',
      title: 'Da dinh kem',
      tabId: 42,
    }

    const result = await attachTab(42, [existing])

    expect(captureTabContextMock).not.toHaveBeenCalled()
    expect(result.item).toBe(existing)
  })

  it('tra error khi trich xuat that bai (pdf khong doc duoc)', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/file.pdf',
      title: 'file.pdf',
      tabId: 7,
      sourceKind: 'pdf',
      contextError: 'CONTEXT_PDF_NOT_READABLE',
      contextErrorMessage: 'Khong doc duoc file PDF.',
    })

    const result = await attachTab(7)

    expect(result.error).toBe('CONTEXT_PDF_NOT_READABLE')
    expect(result.errorMessage).toBe('Khong doc duoc file PDF.')
    expect(result.sourceKind).toBe('pdf')
    // Van tao item (co url + title) → user van thay chip.
    expect(result.item).toBeDefined()
  })

  it('khong tao item khi trang rong hoan toan', async () => {
    captureTabContextMock.mockResolvedValue({ url: '', title: '', tabId: 9 })

    const result = await attachTab(9)

    expect(result.item).toBeUndefined()
  })

  it('khong throw khi capture that bai → tra item undefined', async () => {
    captureTabContextMock.mockRejectedValue(new Error('boom'))

    const result = await attachTab(9)

    expect(result.item).toBeUndefined()
    expect(result.error).toBeUndefined()
  })
})

describe('cache context theo URL (T-M1-06)', () => {
  beforeEach(async () => {
    const { clearContextCache } = await import('../src/lib/contextCache.js')
    await clearContextCache()
  })

  it('trang co noi dung → duoc ghi vao cache', async () => {
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      tabId: 42,
      text: 'Noi dung chinh.',
      sourceKind: 'html',
    })

    await attachTab(42)

    const { readCachedContext } = await import('../src/lib/contextCache.js')
    const cached = await readCachedContext('https://example.com/bai-viet')
    expect(cached?.text).toBe('Noi dung chinh.')
  })

  it('trang khong doc duoc → FALLBACK ve noi dung da cache', async () => {
    const { writeCachedContext } = await import('../src/lib/contextCache.js')
    await writeCachedContext({
      url: 'https://example.com/file.pdf',
      title: 'file.pdf',
      text: 'Noi dung PDF da capture truoc.',
      excerpt: 'Noi dung PDF da capture truoc.',
      sourceKind: 'pdf',
      contentHash: 'hash-pdf',
      capturedAt: Date.now(),
    })

    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/file.pdf',
      title: 'file.pdf',
      tabId: 7,
      sourceKind: 'pdf',
      contextError: 'CONTEXT_PDF_NOT_READABLE',
      contextErrorMessage: 'Khong doc duoc file PDF.',
    })

    const result = await attachTab(7)

    expect(result.error).toBe('CONTEXT_PDF_NOT_READABLE')
    // Van tra ve item — nhung dung NOI DUNG DA CACHE thay vi rong.
    expect(result.item?.text).toBe('Noi dung PDF da capture truoc.')
  })

  it('noi dung moi khac → ghi de ban cache (khong dung ban cu)', async () => {
    const { readCachedContext, writeCachedContext } = await import('../src/lib/contextCache.js')
    await writeCachedContext({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      text: 'NOI DUNG CU.',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-old',
      capturedAt: Date.now() - 1000,
    })

    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      tabId: 42,
      text: 'NOI DUNG MOI.',
      sourceKind: 'html',
    })

    const result = await attachTab(42)

    expect(result.item?.text).toBe('NOI DUNG MOI.')

    const cached = await readCachedContext('https://example.com/bai-viet')
    expect(cached?.text).toBe('NOI DUNG MOI.')
  })

  it('URL khac → khong dung nhầm cache cua trang khac', async () => {
    const { writeCachedContext } = await import('../src/lib/contextCache.js')
    await writeCachedContext({
      url: 'https://example.com/a',
      title: 'A',
      text: 'NOI DUNG A.',
      excerpt: undefined,
      sourceKind: 'html',
      contentHash: 'hash-a',
      capturedAt: Date.now(),
    })

    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/b',
      title: 'B',
      tabId: 43,
      sourceKind: 'html',
    })

    const result = await attachTab(43)

    expect(result.item?.text).toBeUndefined()
  })

  it('noi dung KHONG doi → giu nguyen capturedAt (khong refresh TTL)', async () => {
    const { readCachedContext } = await import('../src/lib/contextCache.js')

    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      tabId: 42,
      text: 'NOI DUNG GIONG NHAU.',
      sourceKind: 'html',
    })

    await attachTab(42)
    const first = await readCachedContext('https://example.com/bai-viet')
    expect(first?.capturedAt).toBeDefined()

    // Doi thoi diem capture → noi dung van giong → KHONG ghi lai cache
    // (giu `capturedAt` cu → TTL khong bi reset).
    const later = Date.now() + 60_000
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(later)

    await attachTab(42)

    dateSpy.mockRestore()

    const second = await readCachedContext('https://example.com/bai-viet')
    expect(second?.capturedAt).toBe(first?.capturedAt)
  })

  it('noi dung DOI → capturedAt duoc cap nhat', async () => {
    const { readCachedContext } = await import('../src/lib/contextCache.js')

    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      tabId: 42,
      text: 'NOI DUNG CU.',
      sourceKind: 'html',
    })

    await attachTab(42)
    const first = await readCachedContext('https://example.com/bai-viet')

    const later = Date.now() + 60_000
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(later)

    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/bai-viet',
      title: 'Bai viet',
      tabId: 42,
      text: 'NOI DUNG MOI.',
      sourceKind: 'html',
    })

    await attachTab(42)

    dateSpy.mockRestore()

    const second = await readCachedContext('https://example.com/bai-viet')
    expect(second?.text).toBe('NOI DUNG MOI.')
    expect(second?.capturedAt).toBe(later)
    expect(second?.capturedAt).not.toBe(first?.capturedAt)
  })
})

describe('attachCurrentTab', () => {
  it('dung tab dang active', async () => {
    getActiveTabIdMock.mockResolvedValue(5)
    captureTabContextMock.mockResolvedValue({
      url: 'https://example.com/',
      title: 'Trang hom',
      tabId: 5,
    })

    const result = await attachCurrentTab()

    expect(captureTabContextMock).toHaveBeenCalledWith(5)
    expect(result.item?.tabId).toBe(5)
  })

  it('khong co tab active → khong tao item', async () => {
    getActiveTabIdMock.mockResolvedValue(undefined)

    const result = await attachCurrentTab()

    expect(captureTabContextMock).not.toHaveBeenCalled()
    expect(result.item).toBeUndefined()
  })
})

describe('tabItemId', () => {
  it('sinh id dinh danh theo tabId', () => {
    expect(tabItemId(42)).toBe('tab-42')
  })
})

describe('attachSelection', () => {
  const selection = {
    id: 'selection-abc',
    text: 'Doan van ban da boi den tren trang web',
    url: 'https://example.com/',
    title: 'Bai viet mau',
    tabId: 42,
    createdAt: 1_700_000_000_000,
  }

  it('tao item context voi kind/tier selection', () => {
    const result = attachSelection(selection)

    expect(result.item).toBeDefined()
    expect(result.item?.kind).toBe('selection')
    expect(result.item?.tier).toBe('selection')
    expect(result.item?.text).toBe('Doan van ban da boi den tren trang web')
    expect(result.item?.url).toBe('https://example.com/')
    expect(result.item?.title).toBe('Bai viet mau')
    expect(result.item?.tabId).toBe(42)
    expect(result.item?.id).toBe('selection-abc')
  })

  it('doan chon co tier CAO NHAT (uoc tien cat bot)', () => {
    const result = attachSelection(selection)

    // `selection` phai dung dau trong thu tu uu tien.
    expect(result.item?.tier).toBe('selection')
  })

  it('tao excerpt ngan de preview tren chip', () => {
    const result = attachSelection(selection)

    expect(result.item?.excerpt).toBeDefined()
    expect(result.item?.excerpt?.length).toBeLessThanOrEqual(
      selection.text.length,
    )
  })

  it('doan rong → error CONTEXT_SELECTION_EMPTY, khong tao item', () => {
    const result = attachSelection({ ...selection, text: '   ' })

    expect(result.item).toBeUndefined()
    expect(result.error).toBe('CONTEXT_SELECTION_EMPTY')
    expect(result.errorMessage).toBeDefined()
  })

  it('id rong → sinh id tu hash noi dung', () => {
    const result = attachSelection({ ...selection, id: '' })

    expect(result.item?.id).toMatch(/^selection-[0-9a-f]+$/)
  })

  it('khong co url → bo qua truong url (khong tao undefined)', () => {
    const result = attachSelection({ ...selection, url: '' })

    expect(result.item?.url).toBeUndefined()
  })

  it('khong co tabId → bo qua truong tabId', () => {
    const result = attachSelection({ ...selection, tabId: undefined })

    expect(result.item?.tabId).toBeUndefined()
  })

  it('khong co title → dung nhan mac dinh', () => {
    const result = attachSelection({ ...selection, title: '' })

    expect(result.item?.title).toBe('Đoạn đã bôi đen')
  })
})

describe('captureActiveSelection', () => {
  it('doc duoc selection tren tab active', async () => {
    getActiveTabIdMock.mockResolvedValue(5)
    const { executeScriptMock, injectionResult } = await import('./setup.js')
    executeScriptMock.mockResolvedValueOnce([
      injectionResult({
        text: 'Doan van ban dang boi tren trang',
        title: 'Bai viet mau',
        url: 'https://example.com/',
      }),
    ])

    const result = await captureActiveSelection()

    expect(result?.text).toBe('Doan van ban dang boi tren trang')
    expect(result?.title).toBe('Bai viet mau')
    expect(result?.tabId).toBe(5)
    expect(result?.id).toMatch(/^selection-[0-9a-f]+$/)
  })

  it('selection rong → undefined', async () => {
    getActiveTabIdMock.mockResolvedValue(5)
    const { executeScriptMock, injectionResult } = await import('./setup.js')
    executeScriptMock.mockResolvedValueOnce([injectionResult(null)])

    expect(await captureActiveSelection()).toBeUndefined()
  })

  it('selection qua ngan → undefined', async () => {
    getActiveTabIdMock.mockResolvedValue(5)
    const { executeScriptMock, injectionResult } = await import('./setup.js')
    executeScriptMock.mockResolvedValueOnce([injectionResult({ text: 'ngan' })])

    expect(await captureActiveSelection()).toBeUndefined()
  })

  it('khong co tab active → undefined', async () => {
    getActiveTabIdMock.mockResolvedValue(undefined)

    expect(await captureActiveSelection()).toBeUndefined()
  })

  it('executeScript that bai → undefined, khong throw', async () => {
    getActiveTabIdMock.mockResolvedValue(5)
    const { executeScriptMock } = await import('./setup.js')
    executeScriptMock.mockRejectedValueOnce(new Error('no permission'))

    expect(await captureActiveSelection()).toBeUndefined()
  })
})
