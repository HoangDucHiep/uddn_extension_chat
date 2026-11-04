import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { captureTabContext } from '../src/lib/pageContext.js'
import { requestExtract } from '../src/lib/extractClient.js'

/**
 * Test cho nhanh trich xuat context PDF / YouTube (T-M1-21, T-M1-22).
 *
 * Nhanh HTML giu nguyen hanh cua T-M1-01 (xem `pageContext.test.ts`).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.1
 */

vi.mock('../src/lib/extractClient.js', () => ({
  requestExtract: vi.fn(),
}))

const requestExtractMock = requestExtract as unknown as Mock<
  (kind: 'pdf' | 'youtube', url: string) => Promise<{
    text: string
    title: string | undefined
    truncated: boolean
    error: string | undefined
    errorMessage: string | undefined
  }>
>

const tabsGet = chrome.tabs.get as unknown as Mock<
  (tabId: number) => Promise<chrome.tabs.Tab | undefined>
>

/** Mock tab dang mo. */
function mockTab(url: string, title: string): void {
  tabsGet.mockResolvedValue({ id: 7, url, title } as chrome.tabs.Tab)
}

describe('captureTabContext — nhanh PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTab('https://example.com/tai-lieu.pdf', 'Tai lieu PDF')
  })

  it('goi BFF endpoint pdf va merge text/excerpt vao context', async () => {
    requestExtractMock.mockResolvedValue({
      text: 'Noi dung PDF da trich xuat.',
      title: 'Tai lieu PDF',
      truncated: false,
      error: undefined,
      errorMessage: undefined,
    })

    const context = await captureTabContext(7)

    expect(requestExtractMock).toHaveBeenCalledWith('pdf', 'https://example.com/tai-lieu.pdf')
    expect(context.sourceKind).toBe('pdf')
    expect(context.text).toBe('Noi dung PDF da trich xuat.')
    expect(context.excerpt).toBe('Noi dung PDF da trich xuat.')
    expect(context.contextError).toBeUndefined()
  })

  it('dat contextError khi PDF khong doc duoc, khong throw', async () => {
    requestExtractMock.mockResolvedValue({
      text: '',
      title: undefined,
      truncated: false,
      error: 'CONTEXT_PDF_NOT_READABLE',
      errorMessage: 'PDF khong co text layer',
    })

    const context = await captureTabContext(7)

    expect(context.sourceKind).toBe('pdf')
    expect(context.contextError).toBe('CONTEXT_PDF_NOT_READABLE')
    expect(context.contextErrorMessage).toBe('PDF khong co text layer')
    expect(context.text).toBeUndefined()
  })
})

describe('captureTabContext — nhanh YouTube', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTab('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Video hoc AI')
  })

  it('goi BFF endpoint youtube va gan sourceKind', async () => {
    requestExtractMock.mockResolvedValue({
      text: '[00:00] Xin chao cac ban',
      title: 'Video hoc AI',
      truncated: false,
      error: undefined,
      errorMessage: undefined,
    })

    const context = await captureTabContext(7)

    expect(requestExtractMock).toHaveBeenCalledWith(
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )
    expect(context.sourceKind).toBe('youtube')
    expect(context.text).toBe('[00:00] Xin chao cac ban')
  })

  it('dat contextError khi video khong co caption', async () => {
    requestExtractMock.mockResolvedValue({
      text: '',
      title: undefined,
      truncated: false,
      error: 'CONTEXT_TRANSCRIPT_UNAVAILABLE',
      errorMessage: 'Video khong co phu de',
    })

    const context = await captureTabContext(7)

    expect(context.contextError).toBe('CONTEXT_TRANSCRIPT_UNAVAILABLE')
    expect(context.sourceKind).toBe('youtube')
  })
})

describe('captureTabContext — trang dac biet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('khong goi BFF khi URL khong phai http(s)', async () => {
    mockTab('chrome://extensions', 'Extensions')

    const context = await captureTabContext(7)

    expect(requestExtractMock).not.toHaveBeenCalled()
    expect(context.url).toBe('chrome://extensions')
    expect(context.sourceKind).toBeUndefined()
  })

  it('khong goi BFF khi khong co url', async () => {
    tabsGet.mockResolvedValue(undefined)

    const context = await captureTabContext(7)

    expect(requestExtractMock).not.toHaveBeenCalled()
    expect(context.url).toBe('')
  })
})
