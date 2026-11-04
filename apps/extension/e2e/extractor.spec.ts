import { expect } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: content script extractor chay that tren trang web that.
 *
 * Kiem chung:
 *  - `content.js` load duoc (khong loi ESM) — rule mv3-chrome.mdc §6
 *  - service worker goi `chrome.scripting.executeScript` trich duoc
 *    title + noi dung chinh tren trang that
 *  - noi dung nhieu (nav/footer/sidebar) bi lo bo
 *  - title uu tien `og:title`
 *
 * LUU Y: content script chay trong "isolated world" → `window` cua no KHONG
 * nhin thay duoc tu page script hay `page.evaluate`. Phai goi qua service
 * worker (`chrome.scripting.executeScript`) — cung duong chinh panel dung.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3 (T-M1-01)
 */

/** HTML fixture — trang blog co nav/sidebar/footer nhieu + `<article>` noi dung chinh. */
const ARTICLE_HTML = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>Tieu de trong the title</title>
    <meta property="og:title" content="Bai viet ve Sidekick AI" />
    <meta name="author" content="Nguyen Van A" />
  </head>
  <body>
    <nav class="site-nav"><a href="/">Trang chu</a><a href="/blog">Blog</a></nav>
    <div class="sidebar"><p>Quang cao can loai bo khi trich xuat.</p></div>
    <article class="post-content">
      <h1>Bai viet ve Sidekick AI</h1>
      <p>Doan van dau cua bai viet, nay la noi dung chinh cua trang.</p>
      <p>Doan van thu hai, van thuoc phan noi dung chinh duoc trich.</p>
    </article>
    <footer>Chu ky ban quyen o chan trang</footer>
  </body>
</html>`

/** Shape ket qua extractor (mirror `ExtractedPage`). */
interface ExtractedPage {
  title: string
  byline: string
  url: string
  text: string
  excerpt: string
  strategy: string
  wordCount: number
}

test('content script trich dung title + noi dung chinh tren trang that', async ({
  context,
}) => {
  // Trang that tren http://sidekick.test de content script (matches <all_urls>) chay.
  const page = await context.newPage()
  await page.route('http://sidekick.test/article', (route) => {
    route.fulfill({ status: 200, contentType: 'text/html', body: ARTICLE_HTML })
  })
  await page.goto('http://sidekick.test/article')

  // Service worker = noi co `chrome.scripting` + host permissions.
  let worker = context.serviceWorkers()[0]
  if (!worker) {
    worker = await context.waitForEvent('serviceworker')
  }

  // Cho content script inject xong (document_idle).
  await page.waitForTimeout(1000)

  const extracted = (await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: 'http://sidekick.test/article' })
    const tabId = tabs[0]?.id
    if (tabId === undefined) return null

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () =>
        (
          window as unknown as {
            __sidekickExtractContent?: () => unknown
          }
        ).__sidekickExtractContent?.() ?? null,
    })
    return results[0]?.result ?? null
  })) as ExtractedPage | null

  expect(extracted).not.toBeNull()
  expect(extracted?.title).toBe('Bai viet ve Sidekick AI')
  expect(extracted?.byline).toBe('Nguyen Van A')
  expect(extracted?.strategy).toBe('article')
  expect(extracted?.text).toContain('Doan van dau cua bai viet')
  expect(extracted?.text).toContain('Doan van thu hai')
  expect(extracted?.text).not.toContain('Trang chu')
  expect(extracted?.text).not.toContain('Quang cao can loai bo')
  expect(extracted?.text).not.toContain('Chu ky ban quyen')
  expect(extracted?.wordCount).toBeGreaterThan(0)

  await page.close()
})
