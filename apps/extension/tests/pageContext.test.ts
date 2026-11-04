import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { captureTabContext } from '../src/lib/pageContext.js'
import type { ExtractedPage } from '../src/content/extractor.js'

/**
 * Test cho `captureTabContext` — cau noi tab → content script → PageContext.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7 (Unit test)
 */

/** Ket qua extractor mau. */
const SAMPLE_PAGE: ExtractedPage = {
  title: 'Tieu de trang',
  byline: 'Tac gia',
  url: 'https://example.com/bai-viet',
  text: 'Noi dung chinh cua trang duoc trich xuat thanh cong.',
  excerpt: 'Noi dung chinh cua trang duoc trich xuat thanh cong.',
  strategy: 'article',
  wordCount: 9,
}

/** Mock `chrome.tabs.get` — cast vi setup.ts khong khai bao generic. */
const tabsGet = chrome.tabs.get as unknown as Mock<
  (tabId: number) => Promise<chrome.tabs.Tab | undefined>
>

/** Mock `chrome.scripting.executeScript`. */
const executeScript = chrome.scripting.executeScript as unknown as Mock<
  (
    injection: chrome.scripting.ScriptInjection<[], unknown>,
  ) => Promise<chrome.scripting.InjectionResult[]>
>

/** Tao ket qua injection giong nhu thu te. */
function injectionResult(result: unknown): chrome.scripting.InjectionResult[] {
  return [{ frameId: 0, result }] as chrome.scripting.InjectionResult[]
}

describe('captureTabContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tabsGet.mockResolvedValue({
      id: 7,
      url: 'https://example.com/bai-viet',
      title: 'Tieu de trang',
    } as chrome.tabs.Tab)
  })

  it('tra PageContext day du khi content script tra ket qua', async () => {
    executeScript.mockResolvedValueOnce(injectionResult(SAMPLE_PAGE))

    const context = await captureTabContext(7)

    expect(context.url).toBe('https://example.com/bai-viet')
    expect(context.title).toBe('Tieu de trang')
    expect(context.tabId).toBe(7)
    expect(context.text).toBe(SAMPLE_PAGE.text)
    expect(context.excerpt).toBe(SAMPLE_PAGE.excerpt)
  })

  it('fallback ve context toi thieu khi khong trich duoc noi dung', async () => {
    executeScript.mockResolvedValueOnce([])
    executeScript.mockResolvedValueOnce([])

    const context = await captureTabContext(7)

    expect(context.url).toBe('https://example.com/bai-viet')
    expect(context.title).toBe('Tieu de trang')
    expect(context.text).toBeUndefined()
    expect(context.excerpt).toBeUndefined()
  })

  it('khong throw khi tab khong truy cap duoc (trang dac biet)', async () => {
    tabsGet.mockRejectedValueOnce(new Error('No tab with id'))
    executeScript.mockResolvedValueOnce([])
    executeScript.mockResolvedValueOnce([])

    const context = await captureTabContext(7)

    expect(context.url).toBe('')
    expect(context.title).toBe('')
    expect(context.tabId).toBe(7)
  })

  it('inject content.js roi thu lai khi content script chua san sang', async () => {
    executeScript
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(injectionResult(SAMPLE_PAGE))

    const context = await captureTabContext(7)

    expect(context.text).toBe(SAMPLE_PAGE.text)
    // Lan 2 phai inject file content.js.
    expect(executeScript).toHaveBeenCalledTimes(3)
    const injectCall = executeScript.mock.calls[1]?.[0] as {
      files?: string[]
    }
    expect(injectCall.files).toEqual(['content.js'])
  })

  it('bo qua ket qua khong dung shape', async () => {
    executeScript.mockResolvedValueOnce(injectionResult({ title: 'khong phai ExtractedPage' }))
    executeScript.mockResolvedValueOnce([])

    const context = await captureTabContext(7)

    expect(context.text).toBeUndefined()
  })
})
