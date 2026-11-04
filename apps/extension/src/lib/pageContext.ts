/**
 * Capture context trang (noi dung chinh + metadata) tu mot tab.
 *
 * Luong: `chrome.tabs.get` → phan nhanh theo loai trang →
 *  - `html`    → `chrome.scripting.executeScript` goi ham trong content script.
 *  - `pdf`     → BFF `POST /api/extract/pdf` (T-M1-21).
 *  - `youtube` → BFF `POST /api/extract/youtube` (T-M1-22).
 *
 * Nguyen tac quan trong:
 *  - KHONG bao gio throw. Trang `chrome://`, Web Store, hoac tab chua inject
 *    content script → tra context toi thieu (url/title) de panel van chat duoc.
 *  - `executeScript` voi `func` serializes ham qua JSON → func phai tu chua,
 *    khong duoc tham chieu bien module-scope.
 *
 * Docs: docs/SYSTEM_DESIGN.md §3 (lib/pageContext.ts), FR-CONTEXT-01/05/06
 */

import { detectPageKind, type PageContext } from '@sidekick/shared'
import type { ExtractedPage } from '../content/extractor.js'
import { requestExtract } from './extractClient.js'

/** Ket qua inject co the tra ve `null` khi content script chua san sang. */
interface InjectionResult {
  result?: unknown
}

/**
 * Lay context cua mot tab.
 *
 * @param tabId - Id cua tab can capture.
 */
export async function captureTabContext(tabId: number): Promise<PageContext> {
  const tab = await getTab(tabId)

  const base: PageContext = {
    url: tab?.url ?? '',
    title: tab?.title ?? '',
    tabId,
  }

  if (base.url.length === 0) {
    return base
  }

  const kind = detectPageKind(base.url)

  // Trang dac biet (`chrome://`, `file://`) → khong trich xuat gi.
  if (kind === 'unknown') {
    return base
  }

  if (kind === 'pdf' || kind === 'youtube') {
    return captureRemoteContext(base, kind)
  }

  return captureHtmlContext(base, tabId)
}

/**
 * Nhanh HTML — doc DOM qua content script.
 *
 * Giu nguyen hanh vi cua T-M1-01 (khong regression).
 */
async function captureHtmlContext(base: PageContext, tabId: number): Promise<PageContext> {
  const page = await extractFromTab(tabId)

  if (page === null) {
    return { ...base, sourceKind: 'html' }
  }

  return {
    ...base,
    url: page.url.length > 0 ? page.url : base.url,
    title: page.title.length > 0 ? page.title : base.title,
    ...(page.text.length > 0 ? { text: page.text } : {}),
    ...(page.excerpt.length > 0 ? { excerpt: page.excerpt } : {}),
    sourceKind: 'html',
  }
}

/**
 * Nhanh PDF / YouTube — BFF trich xuat server-side.
 *
 * Loi khong duoc nem len → chi gan `contextError` de UI hien thi thong bao.
 */
async function captureRemoteContext(
  base: PageContext,
  kind: 'pdf' | 'youtube',
): Promise<PageContext> {
  const outcome = await requestExtract(kind, base.url)

  if (outcome.error !== undefined) {
    return {
      ...base,
      sourceKind: kind,
      contextError: outcome.error,
      contextErrorMessage: outcome.errorMessage,
    }
  }

  const excerpt = outcome.text.slice(0, 500)

  return {
    ...base,
    ...(outcome.title !== undefined && outcome.title.length > 0
      ? { title: outcome.title }
      : {}),
    ...(outcome.text.length > 0 ? { text: outcome.text } : {}),
    ...(excerpt.length > 0 ? { excerpt } : {}),
    sourceKind: kind,
  }
}

/**
 * Lay id cua tab dang active trong cua so hien tai.
 *
 * Side panel thuoc cua so trinh duyet hien tai → `currentWindow` la dung.
 * Tra `undefined` neu khong tim thay (panel mo o cua so khac).
 */
export async function getActiveTabId(): Promise<number | undefined> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    return tabs[0]?.id
  } catch {
    return undefined
  }
}

/**
 * Trich noi dung tu tab.
 *
 * Neu content script chua duoc inject (trang load truoc khi cai extension),
 * inject `content.js` roi thu lai mot lan.
 */
async function extractFromTab(tabId: number): Promise<ExtractedPage | null> {
  const direct = await runExtractor(tabId)
  if (direct !== null) return direct

  const injected = await injectContentScript(tabId)
  if (!injected) return null

  return runExtractor(tabId)
}

/** Chay ham extractor trong content script cua tab. */
async function runExtractor(tabId: number): Promise<ExtractedPage | null> {
  try {
    const results = (await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.__sidekickExtractContent?.() ?? null,
    })) as InjectionResult[]

    const value = results[0]?.result
    return isExtractedPage(value) ? value : null
  } catch {
    // Khong inject duoc (trang dac biet, khong co quyen) → thu inject roi.
    return null
  }
}

/** Inject `content.js` vao tab (dung khi trang chua co content script). */
async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    })
    return true
  } catch {
    return false
  }
}

/** Doc thong tin tab; khong throw neu tab khong ton tai. */
async function getTab(tabId: number): Promise<chrome.tabs.Tab | undefined> {
  try {
    return await chrome.tabs.get(tabId)
  } catch {
    return undefined
  }
}

/** Type guard — chi nhan ket qua dung shape cua `ExtractedPage`. */
function isExtractedPage(value: unknown): value is ExtractedPage {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<ExtractedPage>
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.byline === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.text === 'string' &&
    typeof candidate.excerpt === 'string' &&
    typeof candidate.strategy === 'string' &&
    typeof candidate.wordCount === 'number'
  )
}
