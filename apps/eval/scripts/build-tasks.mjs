/**
 * Sinh `apps/eval/dataset/tasks.json` tu danh sach nguon trong
 * `dataset_meta.json` (hash + URL + tieu de luon khop snapshot that).
 *
 * Script nay chi dung 1 lan de soan dataset — duoc commit de tai lap.
 * Chay: `node apps/eval/scripts/build-tasks.mjs`
 */

import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..', '..', '..')
const meta = JSON.parse(
  await readFile(resolve(ROOT, 'apps/eval/dataset/dataset_meta.json'), 'utf8'),
)

/** @type {Map<string, any>} */
const bySlug = new Map(meta.sources.map((s) => [s.slug, s]))

/**
 * Tao 1 `page` tu slug nguon.
 * @param {string} slug
 */
function page(slug) {
  const src = bySlug.get(slug)
  if (!src) throw new Error(`Thieu nguon "${slug}" trong dataset_meta.json`)
  if (src.error) throw new Error(`Nguon "${slug}" co loi: ${src.error}`)
  return {
    url: src.url,
    title: src.title,
    snapshot_path: src.snapshot_path,
    content_hash: src.content_hash,
  }
}

/**
 * Tao 1 `asset` tu slug nguon (anh).
 * @param {string} slug
 */
function asset(slug) {
  const src = bySlug.get(slug)
  if (!src) throw new Error(`Thieu nguon "${slug}" trong dataset_meta.json`)
  if (!src.asset_path) throw new Error(`Nguon "${slug}" khong phai anh`)
  return {
    kind: 'image',
    path: src.asset_path,
    mime_type: 'image/png',
    bytes: src.asset_bytes,
    description: src.description,
  }
}

/** Page gia cho nhom `general_qa` (khong gui context — FC-12). */
const NO_CONTEXT_PAGE = {
  url: 'https://sidekick.local/no-context',
  title: '(khong dung context — chat thuan LLM)',
  snapshot_path: 'apps/eval/dataset/snapshots/__no_context__.txt',
  content_hash: 'sha256:none',
}

const tasks = []

// ---------------------------------------------------------------------------
// Nhom page_qa — 12 task (6 VI + 6 EN)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'page-qa-001',
    group: 'page_qa',
    lang: 'vi',
    page: page('chrome-vi-sidepanel'),
    prompt:
      'Dựa trên trang tài liệu này, API chrome.sidePanel cần khai báo quyền nào trong manifest? Từ phiên bản Chrome nào API này khả dụng? Trả lời ngắn gọn bằng tiếng Việt.',
    reference: {
      key_points: [
        'Cần khai báo quyền "sidePanel" trong manifest.json',
        'Khả dụng từ Chrome 114 trở lên',
        'Yêu cầu Manifest V3 trở lên',
      ],
      must_include_facts: ['sidePanel', 'Chrome 114'],
      must_not_contain: ['activeTab là đủ', 'Chrome 100'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'api-reference'],
  },
  {
    id: 'page-qa-002',
    group: 'page_qa',
    lang: 'vi',
    page: page('chrome-vi-tabs'),
    prompt:
      'Theo tài liệu chrome.tabs này, quyền "tabs" cho phép đọc được 4 thuộc tính nhạy cảm nào của đối tượng tabs.Tab? Nêu tên đủ 4 thuộc tính.',
    reference: {
      key_points: [
        '4 thuộc tính: url, pendingUrl, title, favIconUrl',
        'Quyền "tabs" cho phép gọi tabs.query() đối với các thuộc tính này',
      ],
      must_include_facts: ['url', 'pendingUrl', 'title', 'favIconUrl'],
      must_not_contain: ['activeTab'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'permissions'],
  },
  {
    id: 'page-qa-003',
    group: 'page_qa',
    lang: 'vi',
    page: page('chrome-vi-storage'),
    prompt:
      'Chrome Storage API có những vùng lưu trữ nào? Nêu tên từng vùng và cho biết vùng nào chỉ tồn tại trong phiên trình duyệt.',
    reference: {
      key_points: [
        'Ba vùng lưu trữ: local, sync, session',
        'session chỉ tồn tại trong phiên trình duyệt (mất khi đóng trình duyệt)',
        'local và sync tồn tại lâu dài',
      ],
      must_include_facts: ['local', 'sync', 'session'],
      must_not_contain: ['IndexedDB là vùng lưu trữ của Storage API'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'storage'],
  },
  {
    id: 'page-qa-004',
    group: 'page_qa',
    lang: 'vi',
    page: page('chrome-vi-contextmenus'),
    prompt:
      'Theo tài liệu này, để dùng chrome.contextMenus cần khai báo quyền gì trong manifest? Ngoài ra nên chỉ định biểu tượng kích thước bao nhiêu pixel cho mục trình đơn?',
    reference: {
      key_points: [
        'Phải khai báo quyền "contextMenus"',
        'Nên chỉ định biểu tượng 16 x 16 pixel',
      ],
      must_include_facts: ['contextMenus', '16 x 16'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'context-menu'],
  },
  {
    id: 'page-qa-005',
    group: 'page_qa',
    lang: 'vi',
    page: page('kubernetes-vi-container'),
    prompt:
      'Theo trang này, một container image trong Kubernetes chứa những gì? Và vì sao container được thiết kế theo hướng stateless và bất biến (immutable)?',
    reference: {
      key_points: [
        'Container image là gói phần mềm sẵn sàng chạy chứa mã chương trình, runtime cần thiết, thư viện ứng dụng và thư viện hệ thống, cùng giá trị mặc định cho thiết lập thiết yếu',
        'Container stateless: không lưu trạng thái giữa các lần gọi',
        'Container bất biến: không nên sửa mã của container đang chạy — phải build image mới rồi tạo lại container',
      ],
      must_include_facts: ['stateless', 'bất biến'],
      must_not_contain: ['container là mutable', 'nên sửa mã container khi đang chạy'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'vi', 'container'],
  },
  {
    id: 'page-qa-006',
    group: 'page_qa',
    lang: 'vi',
    page: page('kubernetes-vi-service'),
    prompt:
      'Service trong Kubernetes giải quyết vấn đề gì? Theo tài liệu, một Service cung cấp endpoint ra sao khi workload được chia thành nhiều backend?',
    reference: {
      key_points: [
        'Service thể hiện ứng dụng đang chạy dưới dạng dịch vụ mạng trên tập Pod',
        'Cung cấp một endpoint duy nhất hướng ra bên ngoài dù workload chia nhiều backend',
        'Không cần sửa đổi ứng dụng hiện có để dùng cơ chế service discovery',
      ],
      must_include_facts: ['Service', 'Pod'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'vi', 'service'],
  },
  {
    id: 'page-qa-007',
    group: 'page_qa',
    lang: 'en',
    page: page('mdn-en-fetch-api'),
    prompt:
      'Based on this MDN page, what does fetch() return, and does it reject when the server responds with an HTTP error status? Answer briefly in English.',
    reference: {
      key_points: [
        'fetch() returns a Promise that resolves to the Response',
        'It resolves as soon as the server responds with headers, even for HTTP error statuses',
        'It is a global method available in Window and Worker contexts',
      ],
      must_include_facts: ['Promise', 'Response'],
      must_not_contain: ['throws on HTTP error', 'rejects on 404'],
    },
    expected_citations: 1,
    tags: ['mdn', 'en', 'fetch'],
  },
  {
    id: 'page-qa-008',
    group: 'page_qa',
    lang: 'en',
    page: page('mdn-en-closures'),
    prompt:
      'According to this MDN page on closures, what exactly is a closure? Explain the role of the lexical environment in one short paragraph (English).',
    reference: {
      key_points: [
        'A closure is the combination of a function bundled together with references to its surrounding state (the lexical environment)',
        'A closure gives a function access to its outer scope',
        'Closures are created every time a function is created',
      ],
      must_include_facts: ['lexical environment', 'outer scope'],
    },
    expected_citations: 1,
    tags: ['mdn', 'en', 'javascript'],
  },
  {
    id: 'page-qa-009',
    group: 'page_qa',
    lang: 'en',
    page: page('webdev-lcp'),
    prompt:
      'According to this web.dev article, what does Largest Contentful Paint measure, and what threshold counts as a good LCP? Answer in English.',
    reference: {
      key_points: [
        'LCP marks the point in the page load timeline when the page main content has likely loaded',
        'It is a Core Web Vital metric for measuring perceived load speed',
        'A good LCP is 2.5 seconds or less',
      ],
      must_include_facts: ['2.5 seconds or less', 'Core Web Vital'],
    },
    expected_citations: 1,
    tags: ['web-performance', 'en', 'lcp'],
  },
  {
    id: 'page-qa-010',
    group: 'page_qa',
    lang: 'en',
    page: page('express-routing'),
    prompt:
      'Based on this Express routing guide, how do you define a route that responds to GET requests, and what must you pass to a callback when you use multiple callbacks? Answer in English.',
    reference: {
      key_points: [
        'Use app.get() to handle GET requests (routing methods correspond to HTTP methods)',
        'app.use() specifies middleware as the callback function',
        'With multiple callbacks you must provide next and call next() to hand off control',
      ],
      must_include_facts: ['app.get', 'next'],
    },
    expected_citations: 1,
    tags: ['express', 'en', 'routing'],
  },
  {
    id: 'page-qa-011',
    group: 'page_qa',
    lang: 'en',
    page: page('react-thinking-in-react'),
    prompt:
      'According to this React tutorial, what are the five steps to implement a UI in React? List them in order, in English.',
    reference: {
      key_points: [
        'Step 1: Break the UI into a component hierarchy',
        'Step 2: Build a static version in React',
        'Step 3: Find the minimal but complete representation of UI state',
        'Step 4: Identify where your state should live',
        'Step 5: Add inverse data flow',
      ],
      must_include_facts: [
        'Break the UI into a component hierarchy',
        'Build a static version',
        'Identify where your state should live',
        'Add inverse data flow',
      ],
    },
    expected_citations: 1,
    tags: ['react', 'en', 'tutorial'],
  },
  {
    id: 'page-qa-012',
    group: 'page_qa',
    lang: 'en',
    page: page('kubernetes-en-overview'),
    prompt:
      'According to this Kubernetes overview page, where does the name "Kubernetes" come from, and what does the abbreviation K8s stand for? Answer in English.',
    reference: {
      key_points: [
        'The name Kubernetes originates from Greek, meaning helmsman or pilot',
        'K8s is an abbreviation resulting from counting the eight letters between the "K" and the "s"',
        'Google open sourced the Kubernetes project in 2014',
      ],
      must_include_facts: ['helmsman', '2014'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'en', 'overview'],
  },
)

// ---------------------------------------------------------------------------
// Nhom summarize — 10 task (5 VI + 5 EN)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'summarize-001',
    group: 'summarize',
    lang: 'vi',
    page: page('chrome-vi-content-scripts'),
    prompt:
      'Tóm tắt trang này thành 5 gạch đầu dòng bằng tiếng Việt, tập trung vào các khái niệm và thuộc tính quan trọng nhất của tập lệnh nội dung.',
    reference: {
      key_points: [
        'Content script chạy trong ngữ cảnh riêng biệt (isolated world) của tiện ích',
        'Có thể truy cập DOM của trang nhưng không chia sẻ JavaScript với trang',
        'Chạy trong một môi trường thực thi riêng, an toàn hơn',
      ],
      must_include_facts: ['isolated world'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'summary'],
  },
  {
    id: 'summarize-002',
    group: 'summarize',
    lang: 'vi',
    page: page('chrome-vi-scripting'),
    prompt:
      'Tóm tắt trang tài liệu chrome.scripting này thành tối đa 6 gạch đầu dòng tiếng Việt: các khái niệm chính, các hàm API quan trọng và cách chỉ định target.',
    reference: {
      key_points: [
        'chrome.scripting dùng để chèn JavaScript/CSS vào trang',
        'Hàm quan trọng: executeScript (và insertCSS/removeCSS)',
        'target chỉ định mục tiêu chèn: tabId, allFrames, frameIds',
      ],
      must_include_facts: ['executeScript', 'target'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'summary'],
  },
  {
    id: 'summarize-003',
    group: 'summarize',
    lang: 'vi',
    page: page('chrome-vi-storage-buckets'),
    prompt:
      'Tóm tắt ý chính của bài viết về Storage Buckets thành 4–6 gạch đầu dòng tiếng Việt, nêu rõ vấn đề mà API này giải quyết.',
    reference: {
      key_points: [
        'Storage Standard định nghĩa API cho bộ nhớ cố định và số liệu ước tính về hạn mức',
        'Tính năng có sẵn từ Chromium 122',
        'persist() của StorageManager là "tất cả hoặc không có gì" — không thể diễn đạt nhu cầu lưu trữ chi tiết hơn',
        'Storage Buckets cho phép tạo nhiều bộ nhớ, trình duyệt xoá từng bộ nhớ độc lập',
      ],
      must_include_facts: ['Chromium 122', 'persist()'],
    },
    expected_citations: 1,
    tags: ['chrome', 'vi', 'storage'],
  },
  {
    id: 'summarize-004',
    group: 'summarize',
    lang: 'vi',
    page: page('chrome-vi-lighthouse'),
    prompt:
      'Tóm tắt trang giới thiệu Lighthouse này thành 4–6 gạch đầu dòng tiếng Việt: Lighthouse kiểm tra những khía cạnh nào và có thể chạy ở đâu.',
    reference: {
      key_points: [
        'Lighthouse có kiểm tra hiệu suất, khả năng hỗ trợ tiếp cận, ứng dụng web tiến bộ, SEO',
        'Có thể chạy trong PageSpeed Insights, trong Công cụ của Chrome cho nhà phát triển, từ dòng lệnh hoặc dưới dạng mô-đun Node',
        'Mỗi kiểm tra có tài liệu tham khảo giải thích lý do quan trọng và cách khắc phục',
      ],
      must_include_facts: ['PageSpeed Insights', 'SEO'],
    },
    expected_citations: 1,
    tags: ['chrome', 'vi', 'lighthouse'],
  },
  {
    id: 'summarize-005',
    group: 'summarize',
    lang: 'vi',
    page: page('kubernetes-vi-deployment'),
    prompt:
      'Tóm tắt trang về Deployment trong Kubernetes thành 5 gạch đầu dòng tiếng Việt, giải thích vai trò của ReplicaSet và Deployment Controller.',
    reference: {
      key_points: [
        'Deployment quản lý một tập hợp các Pod để chạy workload ứng dụng, thường là ứng dụng không duy trì trạng thái',
        'Deployment cung cấp khả năng cập nhật dạng khai báo cho các Pod và ReplicaSet',
        'Deployment Controller thay đổi trạng thái thực tế sang trạng thái mong muốn với tốc độ được kiểm soát',
      ],
      must_include_facts: ['ReplicaSet', 'Deployment Controller'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'vi', 'summary'],
  },
  {
    id: 'summarize-006',
    group: 'summarize',
    lang: 'en',
    page: page('webdev-service-worker'),
    prompt:
      'Summarize this article about service worker caching and HTTP caching into 4–6 bullet points (English). Explain the caching order the browser follows.',
    reference: {
      key_points: [
        'Caching order: service worker cache, then HTTP cache, then the network',
        'Service worker caching is not automatic — you must create a fetch event handler and intercept requests',
        'If found in the HTTP cache and not expired, the browser automatically uses the cached resource',
      ],
      must_include_facts: ['HTTP cache', 'network'],
    },
    expected_citations: 1,
    tags: ['web-performance', 'en', 'service-worker'],
  },
  {
    id: 'summarize-007',
    group: 'summarize',
    lang: 'en',
    page: page('mdn-en-css-grid'),
    prompt:
      'Summarize this MDN page on CSS grid layout in 4–6 bullet points (English). Mention the example grid properties used.',
    reference: {
      key_points: [
        'Grid layout divides a page into major regions and aligns elements into columns and rows',
        'Unlike tables, grid items can overlap and layer',
        'The example uses grid-template-columns: repeat(3, 1fr), gap: 10px and grid-auto-rows: minmax(100px, auto)',
        'Items are placed with line-based placement via grid-column / grid-row',
      ],
      must_include_facts: ['repeat(3, 1fr)', 'grid-auto-rows'],
    },
    expected_citations: 1,
    tags: ['mdn', 'en', 'css'],
  },
  {
    id: 'summarize-008',
    group: 'summarize',
    lang: 'en',
    page: page('wikipedia-en-sql'),
    prompt:
      'Summarize this Wikipedia article about SQL into 4–6 bullet points (English). Include the paradigm, the designer, and the standardization history.',
    reference: {
      key_points: [
        'SQL = Structured Query Language',
        'Paradigm: declarative; family: query language',
        'Designed by Donald D. Chamberlin and Raymond F. Boyce',
        'Standardized versions include SQL-86, SQL-89, SQL-92 and later revisions up to SQL:2023',
      ],
      must_include_facts: ['Structured Query Language', 'declarative'],
    },
    expected_citations: 1,
    tags: ['wikipedia', 'en', 'sql'],
  },
  {
    id: 'summarize-009',
    group: 'summarize',
    lang: 'en',
    page: page('postgresql-create-view'),
    prompt:
      'Summarize the PostgreSQL CREATE VIEW reference in 4–6 bullet points (English). Include the synopsis form and what CREATE OR REPLACE VIEW does.',
    reference: {
      key_points: [
        'CREATE VIEW defines a view of a query',
        'Synopsis: CREATE [ OR REPLACE ] [ TEMP | TEMPORARY ] [ RECURSIVE ] VIEW name [ ( column_name [, ...] ) ]',
        'CREATE OR REPLACE VIEW replaces an existing view of the same name',
      ],
      must_include_facts: ['OR REPLACE', 'RECURSIVE'],
    },
    expected_citations: 1,
    tags: ['postgresql', 'en', 'sql'],
  },
  {
    id: 'summarize-010',
    group: 'summarize',
    lang: 'en',
    page: page('kubernetes-en-container'),
    prompt:
      'Summarize this Kubernetes page about containers into 4–6 bullet points (English). Cover container images, statelessness, and container runtimes.',
    reference: {
      key_points: [
        'A container image is a ready-to-run software package containing the code, runtime, application and system libraries and default settings',
        'Containers are intended to be stateless and immutable',
        'Containers decouple applications from the underlying host infrastructure',
        'Containers in a Pod are co-located and co-scheduled to run on the same node',
      ],
      must_include_facts: ['stateless', 'immutable'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'en', 'summary'],
  },
)

// ---------------------------------------------------------------------------
// Nhom cross_tab — 10 task (5 VI + 5 EN), moi task 2–3 trang
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'cross-tab-001',
    group: 'cross_tab',
    lang: 'vi',
    context_mode: 'pages',
    page: page('chrome-vi-sidepanel'),
    pages: [page('chrome-vi-mv3')],
    prompt:
      'So sánh tài liệu Side Panel API và tài liệu chuyển sang Manifest V3. Trả lời bằng tiếng Việt: để chạy được Side Panel API trong MV3 cần những gì (quyền, phiên bản Chrome, thay đổi nền tảng nào đi kèm)?',
    reference: {
      key_points: [
        'Cần quyền "sidePanel" trong manifest',
        'Side Panel API khả dụng từ Chrome 114 và yêu cầu MV3',
        'Trong MV3, trang nền/trang sự kiện được thay bằng trình chạy dịch vụ (service worker)',
      ],
      must_include_facts: ['sidePanel', 'Chrome 114', 'service worker'],
    },
    expected_citations: 2,
    tags: ['chrome-extensions', 'vi', 'cross-tab'],
  },
  {
    id: 'cross-tab-002',
    group: 'cross_tab',
    lang: 'vi',
    context_mode: 'pages',
    page: page('chrome-vi-storage'),
    pages: [page('chrome-vi-storage-buckets')],
    prompt:
      'Dựa trên hai trang về Storage API và Storage Buckets, hãy giải thích bằng tiếng Việt sự khác biệt giữa việc lưu trữ trong tiện ích Chrome và việc quản lý bộ nhớ của trang web.',
    reference: {
      key_points: [
        'chrome.storage là API riêng dành cho tiện ích, có các vùng local/sync/session',
        'Storage Buckets API cho phép trang web tạo nhiều bộ nhớ và trình duyệt xoá từng bộ nhớ độc lập',
        'Tính năng Storage Buckets có sẵn từ Chromium 122',
      ],
      must_include_facts: ['local', 'session', 'Chromium 122'],
    },
    expected_citations: 2,
    tags: ['chrome', 'vi', 'cross-tab'],
  },
  {
    id: 'cross-tab-003',
    group: 'cross_tab',
    lang: 'vi',
    context_mode: 'pages',
    page: page('kubernetes-vi-service'),
    pages: [page('kubernetes-vi-container')],
    prompt:
      'So sánh trang Service và trang Container của Kubernetes (tiếng Việt): Service quản lý mạng ở tầng nào, còn Container thì đóng gói ở tầng nào? Nêu rõ cách Pod liên quan đến cả hai.',
    reference: {
      key_points: [
        'Container đóng gói ứng dụng cùng thành phần phụ thuộc; các container trong một Pod được đặt cùng vị trí và lập lịch cùng nhau trên một node',
        'Service thể hiện ứng dụng đang chạy (một tập Pod) dưới dạng dịch vụ mạng với một endpoint duy nhất',
        'Service không cần sửa ứng dụng hiện có để dùng service discovery',
      ],
      must_include_facts: ['Pod', 'endpoint'],
    },
    expected_citations: 2,
    tags: ['kubernetes', 'vi', 'cross-tab'],
  },
  {
    id: 'cross-tab-004',
    group: 'cross_tab',
    lang: 'vi',
    context_mode: 'pages',
    page: page('chrome-vi-tabs'),
    pages: [page('chrome-vi-windows'), page('chrome-vi-contextmenus')],
    prompt:
      'Từ ba trang tài liệu về tabs, windows và contextMenus, hãy so sánh bằng tiếng Việt: mỗi API cần quyền gì trong manifest và liệu có cần quyền "tabs" riêng hay không?',
    reference: {
      key_points: [
        'chrome.contextMenus cần khai báo quyền "contextMenus"',
        'chrome.windows cần khai báo quyền "tabs" nếu muốn truy cập url/pendingUrl/title/favIconUrl',
        'chrome.tabs: quyền "tabs" cho phép đọc 4 thuộc tính nhạy cảm; "activeTab" chỉ cấp quyền tạm thời cho thẻ hiện tại',
      ],
      must_include_facts: ['contextMenus', 'tabs', 'activeTab'],
    },
    expected_citations: 3,
    tags: ['chrome-extensions', 'vi', 'cross-tab'],
  },
  {
    id: 'cross-tab-005',
    group: 'cross_tab',
    lang: 'vi',
    context_mode: 'pages',
    page: page('kubernetes-vi-memory'),
    pages: [page('kubernetes-vi-tools')],
    prompt:
      'Kết hợp trang cấp phát bộ nhớ cho container và trang cài đặt công cụ Kubernetes, hãy trả lời bằng tiếng Việt: để chạy Kubernetes cục bộ và đặt giới hạn bộ nhớ cho container, cần những công cụ/tham số nào?',
    reference: {
      key_points: [
        'Cần kubectl để triển khai, kiểm tra, quản lý tài nguyên và xem log',
        'kind hoặc minikube để chạy Kubernetes cục bộ (kind cần Docker hoặc Podman)',
        'Đặt memory request và memory limit trong resources.requests / resources.limits',
      ],
      must_include_facts: ['kubectl', 'memory limit'],
    },
    expected_citations: 2,
    tags: ['kubernetes', 'vi', 'cross-tab'],
  },
  {
    id: 'cross-tab-006',
    group: 'cross_tab',
    lang: 'en',
    context_mode: 'pages',
    page: page('mdn-en-fetch-api'),
    pages: [page('mdn-en-http-headers')],
    prompt:
      'Using both the Fetch API page and the HTTP headers reference, explain in English how a fetch() response relates to HTTP headers such as Content-Type, and how CORS fits in.',
    reference: {
      key_points: [
        'The Fetch API uses Request and Response objects plus concepts such as CORS and the HTTP Origin header semantics',
        'fetch() resolves to the Response as soon as the server responds with headers',
        'Content-Type indicates the media type of the resource',
      ],
      must_include_facts: ['CORS', 'Content-Type'],
    },
    expected_citations: 2,
    tags: ['mdn', 'en', 'cross-tab'],
  },
  {
    id: 'cross-tab-007',
    group: 'cross_tab',
    lang: 'en',
    context_mode: 'pages',
    page: page('webdev-lcp'),
    pages: [page('webdev-service-worker')],
    prompt:
      'Combine the LCP article and the service worker caching article (English): explain how service worker caching and HTTP caching interact with the perceived load speed that LCP measures.',
    reference: {
      key_points: [
        'LCP marks when the page main content has likely loaded',
        'Service worker cache is checked first, then HTTP cache, then the network',
        'Service worker caching requires a fetch event handler — it does not happen automatically',
      ],
      must_include_facts: ['LCP', 'HTTP cache'],
    },
    expected_citations: 2,
    tags: ['web-performance', 'en', 'cross-tab'],
  },
  {
    id: 'cross-tab-008',
    group: 'cross_tab',
    lang: 'en',
    context_mode: 'pages',
    page: page('kubernetes-en-service'),
    pages: [page('kubernetes-en-deployment'), page('kubernetes-en-container')],
    prompt:
      'Using the Kubernetes Service, Deployment and Container pages, explain in English how these three objects relate to each other when running an application workload.',
    reference: {
      key_points: [
        'Deployment manages a set of Pods to run an application workload, usually stateless',
        'Containers in a Pod are co-located and co-scheduled on the same node',
        'Service exposes an application running as one or more Pods behind a single outward-facing endpoint',
      ],
      must_include_facts: ['Deployment', 'Service', 'Pod'],
    },
    expected_citations: 3,
    tags: ['kubernetes', 'en', 'cross-tab'],
  },
  {
    id: 'cross-tab-009',
    group: 'cross_tab',
    lang: 'en',
    context_mode: 'pages',
    page: page('postgresql-alter-table'),
    pages: [page('postgresql-create-view'), page('postgresql-string-functions')],
    prompt:
      'Using the three PostgreSQL reference pages (ALTER TABLE, CREATE VIEW, string functions), explain in English how you would add a column, expose it through a view, and then filter or trim its text values.',
    reference: {
      key_points: [
        'ALTER TABLE ... ADD COLUMN changes the definition of a table',
        'CREATE [ OR REPLACE ] VIEW defines a view of a query',
        'PostgreSQL provides string functions and operators for text processing such as trim',
      ],
      must_include_facts: ['ADD COLUMN', 'CREATE VIEW', 'trim'],
    },
    expected_citations: 3,
    tags: ['postgresql', 'en', 'cross-tab'],
  },
  {
    id: 'cross-tab-010',
    group: 'cross_tab',
    lang: 'en',
    context_mode: 'pages',
    page: page('chrome-en-sidepanel'),
    pages: [page('chrome-en-mv3')],
    prompt:
      'Using the English Side Panel API page and the Manifest V3 migration guide, list in English the Chrome version requirements for the sidePanel API and explain what replaced the background page in MV3.',
    reference: {
      key_points: [
        'Side Panel API requires Chrome 114 or later (browser.* alias from Chrome 148)',
        'The sidePanel namespace was introduced in Chrome 116',
        'In MV3 a service worker replaces the extension background or event page',
      ],
      must_include_facts: ['Chrome 114', 'service worker'],
    },
    expected_citations: 2,
    tags: ['chrome-extensions', 'en', 'cross-tab'],
  },
)

// ---------------------------------------------------------------------------
// Nhom writing — 8 task (4 VI + 4 EN)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'writing-001',
    group: 'writing',
    lang: 'vi',
    page: page('chrome-vi-service-workers'),
    prompt:
      'Viết lại nội dung trang này thành một đoạn giải thích ngắn gọn (tối đa 120 từ) cho người mới làm extension, bằng tiếng Việt. Giữ nguyên các thuật ngữ kỹ thuật quan trọng.',
    reference: {
      key_points: [
        'Trình chạy dịch vụ tiện ích là trình xử lý sự kiện trung tâm của tiện ích',
        'Được tải khi cần thiết và huỷ tải khi không hoạt động',
        'Không thể truy cập vào DOM, có thể dùng tài liệu ngoài màn hình (offscreen document)',
      ],
      must_include_facts: ['trình chạy dịch vụ', 'DOM'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'writing'],
  },
  {
    id: 'writing-002',
    group: 'writing',
    lang: 'vi',
    page: page('kubernetes-vi-container'),
    prompt:
      'Viết một đoạn văn tiếng Việt (khoảng 100–130 từ) giải thích cho sinh viên CNTT khái niệm container và container image, dựa đúng vào nội dung trang.',
    reference: {
      key_points: [
        'Container image là gói phần mềm sẵn sàng chạy chứa mã, runtime, thư viện',
        'Container chuẩn hoá hành vi giúp chạy lặp lại được ở mọi nơi',
        'Container tách ứng dụng khỏi hạ tầng máy chủ bên dưới',
        'Container stateless và bất biến',
      ],
      must_include_facts: ['container image', 'stateless'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'vi', 'writing'],
  },
  {
    id: 'writing-003',
    group: 'writing',
    lang: 'vi',
    page: page('kubernetes-vi-tools'),
    prompt:
      'Soạn một đoạn hướng dẫn tiếng Việt (tối đa 120 từ) giới thiệu 3 công cụ kubectl, kind và minikube theo đúng nội dung trang. Nêu rõ công cụ nào cần Docker hoặc Podman.',
    reference: {
      key_points: [
        'kubectl là công cụ dòng lệnh để triển khai, kiểm tra, quản lý tài nguyên và xem log',
        'kind chạy Kubernetes cục bộ và yêu cầu có Docker hoặc Podman',
        'minikube chạy cụm Kubernetes cục bộ tất-cả-trong-một hoặc nhiều-node',
      ],
      must_include_facts: ['kubectl', 'kind', 'minikube', 'Docker'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'vi', 'writing'],
  },
  {
    id: 'writing-004',
    group: 'writing',
    lang: 'vi',
    page: page('chrome-vi-mv3'),
    prompt:
      'Viết một đoạn văn tiếng Việt (khoảng 100–140 từ) tóm lược các nhóm thay đổi chính khi di chuyển tiện ích từ Manifest V2 sang Manifest V3, dựa trên trang này.',
    reference: {
      key_points: [
        'Cập nhật tệp kêhai manifest.json riêng cho V3',
        'Di chuyển sang trình chạy dịch vụ (service worker) thay cho trang nền/trang sự kiện',
        'Cập nhật lệnh gọi API sang các API tương đương hiện đại hơn',
        'Thay thế các trình nghe yêu cầu chặn trên web bằng Declarative Net Request API',
        'Cải thiện tính bảo mật của tiện ích',
      ],
      must_include_facts: ['service worker', 'Declarative Net Request'],
    },
    expected_citations: 1,
    tags: ['chrome-extensions', 'vi', 'writing'],
  },
  {
    id: 'writing-005',
    group: 'writing',
    lang: 'en',
    page: page('mdn-en-closures'),
    prompt:
      'Rewrite the explanation of closures on this page as a clear, beginner-friendly paragraph of 100–130 words in English, keeping the key technical terms accurate.',
    reference: {
      key_points: [
        'A closure is a function bundled with references to its surrounding lexical environment',
        'Lexical scoping uses the location where a variable is declared',
        'Closures are created every time a function is created',
      ],
      must_include_facts: ['lexical environment', 'lexical scoping'],
    },
    expected_citations: 1,
    tags: ['mdn', 'en', 'writing'],
  },
  {
    id: 'writing-006',
    group: 'writing',
    lang: 'en',
    page: page('express-routing'),
    prompt:
      'Write a 100–140 word English paragraph that teaches a beginner how Express routing works, based only on this page. Mention app.get, app.use and the role of next().',
    reference: {
      key_points: [
        'Routing methods correspond to HTTP methods (app.get, app.post)',
        'app.use() specifies middleware as the callback function',
        'With multiple callbacks you must provide next and call next() to hand off control',
      ],
      must_include_facts: ['app.get', 'app.use', 'next'],
    },
    expected_citations: 1,
    tags: ['express', 'en', 'writing'],
  },
  {
    id: 'writing-007',
    group: 'writing',
    lang: 'en',
    page: page('webdev-lcp'),
    prompt:
      'Write a 100–140 word English explanation of what LCP measures and how to improve it, based only on this article. Include the good-LCP threshold.',
    reference: {
      key_points: [
        'LCP marks the point when the main content has likely loaded',
        'A good LCP is 2.5 seconds or less',
        'It is one of the Core Web Vitals metrics',
      ],
      must_include_facts: ['2.5 seconds or less', 'Core Web Vitals'],
    },
    expected_citations: 1,
    tags: ['web-performance', 'en', 'writing'],
  },
  {
    id: 'writing-008',
    group: 'writing',
    lang: 'en',
    page: page('kubernetes-en-deployment'),
    prompt:
      'Write a 100–140 word English paragraph explaining what a Kubernetes Deployment does and how it updates Pods, based only on this page.',
    reference: {
      key_points: [
        'A Deployment manages a set of Pods to run an application workload, usually stateless',
        'Deployment provides declarative updates for Pods and ReplicaSets',
        'The Deployment Controller changes actual state to desired state at a controlled rate',
      ],
      must_include_facts: ['ReplicaSet', 'Deployment Controller'],
    },
    expected_citations: 1,
    tags: ['kubernetes', 'en', 'writing'],
  },
)

// ---------------------------------------------------------------------------
// Nhom vision — 4 task (2 VI + 2 EN)
// Đường A: upload ảnh (Sidekick ✅) · Đường B: ảnh nằm trong DOM (Sidekick ⬜)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'vision-001',
    group: 'vision',
    lang: 'vi',
    page: page('image-python-logo'),
    assets: [asset('image-python-logo')],
    context_mode: 'none',
    prompt:
      'Ảnh đính kèm là logo của dự án nào? Mô tả màu sắc và hình dạng chính của biểu trưng, và cho biết biểu trưng này thuộc về tổ chức nào.',
    reference: {
      key_points: [
        'Logo của Python (python.org)',
        'Hai con rắn xanh lục cách nhau trên nền trắng, tạo hình chữ X',
        'Thuộc Python Software Foundation',
      ],
      must_include_facts: ['Python'],
    },
    expected_citations: 0,
    tags: ['vision', 'vi', 'upload-path'],
    notes:
      'Duong A — user upload anh kem cau hoi (Sidekick AI ho tro day du T-M1-24). Provider phai ho tro vision (gemini).',
  },
  {
    id: 'vision-002',
    group: 'vision',
    lang: 'en',
    page: page('image-postgresql-elephant'),
    assets: [asset('image-postgresql-elephant')],
    context_mode: 'none',
    prompt:
      'What project does the attached image represent? Describe the main visual elements and the animal depicted.',
    reference: {
      key_points: [
        'The PostgreSQL elephant logo (postgresql.org)',
        'A blue elephant',
        'Belongs to the PostgreSQL project / PostgreSQL License brand',
      ],
      must_include_facts: ['PostgreSQL', 'elephant'],
    },
    expected_citations: 0,
    tags: ['vision', 'en', 'upload-path'],
    notes:
      'Duong A — user upload anh kem cau hoi (Sidekick AI ho tro day du T-M1-24). Provider phai ho tro vision (gemini).',
  },
  {
    id: 'vision-003',
    group: 'vision',
    lang: 'vi',
    page: page('image-w3c-logo'),
    assets: [asset('image-w3c-logo')],
    context_mode: 'none',
    prompt:
      'Biểu trưng này thuộc tổ chức nào và viết tắt của tổ chức đó là gì? Nêu lĩnh vực hoạt động chính.',
    reference: {
      key_points: [
        'Logo của W3C (World Wide Web Consortium)',
        'Chữ viết tắt "W3C" hiển thị rõ trong biểu trưng',
        'Tổ chức tiêu chuẩn hoá web — phát triển các tiêu chuẩn web như HTML, CSS',
      ],
      must_include_facts: ['W3C', 'World Wide Web Consortium'],
    },
    expected_citations: 0,
    tags: ['vision', 'vi', 'upload-path'],
    notes:
      'Duong A — user upload anh kem cau hoi (Sidekick AI ho tro day du T-M1-24). Provider phai ho tro vision (gemini).',
  },
  {
    id: 'vision-004',
    group: 'vision',
    lang: 'en',
    page: page('image-rust-logo'),
    assets: [asset('image-rust-logo')],
    context_mode: 'none',
    prompt:
      'Which programming language does this logo belong to, and what does the logo look like? Describe the shape and colours.',
    reference: {
      key_points: [
        'The Rust logo (rust-lang.org)',
        'A gear/cog shape containing the letter R',
        'The Rust programming language',
      ],
      must_include_facts: ['Rust'],
    },
    expected_citations: 0,
    tags: ['vision', 'en', 'dom-image-path'],
    notes:
      'Duong B (dom-image-path): anh nam trong DOM trang dang mo — Sidekick AI CHUA tu lay anh tu DOM (T-M1-01 khong trich xuat <img>) → user phai tai anh roi upload. Ghi "provider limitation" khi doi chieu, KHONG tinh diem 0.',
  },
)

// ---------------------------------------------------------------------------
// Nhom doc_extract — 2 task (1 VI + 1 EN)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'doc-extract-001',
    group: 'doc_extract',
    lang: 'vi',
    page: page('pdf-attention-is-all-you-need'),
    prompt:
      'Đây là text đã trích từ một bài báo khoa học. Hãy trả lời bằng tiếng Việt: (1) tên bài và tác giả, (2) kiến trúc chính được đề xuất, (3) cơ chế attention dùng để cân bằng thông tin.',
    reference: {
      key_points: [
        'Bài "Attention Is All You Need" của Vaswani và cộng sự (Google Brain / Google Research)',
        'Đề xuất kiến trúc Transformer chỉ dựa trên cơ chế attention, loại bỏ hồi quy (recurrence) và tích chập',
        'Multi-head attention cho phép mô hình chú ý tới nhiều vị trí khác nhau cùng lúc',
      ],
      must_include_facts: ['Attention Is All You Need', 'Transformer'],
    },
    expected_citations: 1,
    tags: ['pdf', 'vi', 'doc-extract'],
    notes:
      'FR-CONTEXT-05 — context la text da trich tu PDF (sourceKind pdf). Doi chieu kha nang doc PDF voi Edge Copilot (A20).',
  },
  {
    id: 'doc-extract-002',
    group: 'doc_extract',
    lang: 'en',
    page: page('pdf-bert'),
    prompt:
      'This is extracted text from a research paper. In English, answer: (1) the paper title, (2) what the acronym BERT stands for, and (3) what the model is pre-trained on.',
    reference: {
      key_points: [
        'Paper: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding"',
        'BERT = Bidirectional Encoder Representations from Transformers',
        'Pre-trained on unlabeled text by jointly conditioning on both left and right context in all layers',
      ],
      must_include_facts: ['BERT', 'Bidirectional Encoder Representations from Transformers'],
    },
    expected_citations: 1,
    tags: ['pdf', 'en', 'doc-extract'],
    notes:
      'FR-CONTEXT-05 — context la text da trich tu PDF (sourceKind pdf). Doi chieu kha nang doc PDF voi Edge Copilot (A20).',
  },
)

// ---------------------------------------------------------------------------
// Nhom video_transcript — 2 task (1 VI + 1 EN)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'video-transcript-001',
    group: 'video_transcript',
    lang: 'vi',
    page: page('youtube-js-event-loop'),
    prompt:
      'Dựa trên transcript video này, hãy giải thích bằng tiếng Việt: event loop trong JavaScript gồm những thành phần nào và vì sao JavaScript được coi là "single threaded"?',
    reference: {
      key_points: [
        'JavaScript có 1 call stack và chạy single-threaded',
        'Event loop điều phối giữa call stack và hàng đợi tác vụ (task queue)',
        'Callback được đẩy vào hàng đợi và chạy khi call stack rảnh',
      ],
      must_include_facts: ['call stack', 'single threaded'],
    },
    expected_citations: 1,
    tags: ['youtube', 'vi', 'video-transcript'],
    notes:
      'FR-CONTEXT-06 — context la transcript YouTube (sourceKind youtube). Doi chieu voi Chrome Gemini (B10).',
  },
  {
    id: 'video-transcript-002',
    group: 'video_transcript',
    lang: 'en',
    page: page('youtube-python-tutorial'),
    prompt:
      'Based on this video transcript, summarize in English (5–7 bullet points) what the course teaches and which Python concepts are introduced.',
    reference: {
      key_points: [
        'The course teaches everything needed to get started programming in Python',
        'Python is described as popular and in high demand for jobs',
        'Introduces strings and string methods such as the index() function',
      ],
      must_include_facts: ['Python'],
    },
    expected_citations: 1,
    tags: ['youtube', 'en', 'video-transcript'],
    notes:
      'FR-CONTEXT-06 — context la transcript YouTube (sourceKind youtube). Transcript tieng Anh (video khong co caption tieng Viet) → giu task tieng Anh va ghi ly do nay.',
  },
)

// ---------------------------------------------------------------------------
// Nhom general_qa — 4 task (2 VI + 2 EN), KHONG gui context (FC-12)
// ---------------------------------------------------------------------------

tasks.push(
  {
    id: 'general-qa-001',
    group: 'general_qa',
    lang: 'vi',
    page: NO_CONTEXT_PAGE,
    context_mode: 'none',
    prompt:
      'Không dùng tài liệu nào. Hãy giải thích bằng tiếng Việt sự khác biệt giữa `let`, `const` và `var` trong JavaScript, kèm một ví dụ ngắn cho mỗi từ khoá.',
    reference: {
      key_points: [
        'var có phạm vi hàm và được hoisting (khai báo lên đầu hàm)',
        'let có phạm vi khối, không được hoisting theo cách dùng trước khi khai báo',
        'const có phạm vi khối và binding không thể gán lại',
        'Mỗi từ khoá kèm ví dụ minh hoạ',
      ],
      must_include_facts: ['let', 'const', 'var'],
    },
    expected_citations: 0,
    tags: ['javascript', 'vi', 'no-context'],
    notes:
      'FC-12 — context_mode none: khong gui payload context (do duong "chat thuan LLM"). Chi dung kien thuc pretrained, khong can tra web.',
  },
  {
    id: 'general-qa-002',
    group: 'general_qa',
    lang: 'vi',
    page: NO_CONTEXT_PAGE,
    context_mode: 'none',
    prompt:
      'Không dùng tài liệu nào. Viết một hàm Python `flatten(nested)` nhận một list lồng nhau bất kỳ và trả về list phẳng, kèm ví dụ đầu vào và đầu ra.',
    reference: {
      key_points: [
        'Dung vong lap de quy (recursive) hoac stack',
        'Tra ve list 1 chieu chua moi phan tu',
        'Vi du: [1, [2, [3, 4]], 5] -> [1, 2, 3, 4, 5]',
      ],
      must_include_facts: ['def flatten'],
    },
    expected_citations: 0,
    tags: ['python', 'vi', 'no-context'],
    notes:
      'FC-12 — context_mode none: khong gui payload context. Chi dung kien thuc pretrained, khong can tra web.',
  },
  {
    id: 'general-qa-003',
    group: 'general_qa',
    lang: 'en',
    page: NO_CONTEXT_PAGE,
    context_mode: 'none',
    prompt:
      'Without using any documents, explain in English what the HTTP status codes 200, 301, 404 and 500 mean, and give one typical use case for each.',
    reference: {
      key_points: [
        '200 = request succeeded',
        '301 = permanent redirect',
        '404 = not found',
        '500 = internal server error',
        'One typical use case per code',
      ],
      must_include_facts: ['200', '301', '404', '500'],
    },
    expected_citations: 0,
    tags: ['http', 'en', 'no-context'],
    notes:
      'FC-12 — context_mode none: khong gui payload context. Chi dung kien thuc pretrained, khong can tra web.',
  },
  {
    id: 'general-qa-004',
    group: 'general_qa',
    lang: 'en',
    page: NO_CONTEXT_PAGE,
    context_mode: 'none',
    prompt:
      'Without using any documents, explain in English the difference between a stack and a queue, then write a short Python example for each.',
    reference: {
      key_points: [
        'Stack = LIFO (last in, first out), queue = FIFO (first in, first out)',
        'Python stack example uses list append()/pop() or collections.deque',
        'Python queue example uses collections.deque append()/popleft()',
      ],
      must_include_facts: ['LIFO', 'FIFO', 'deque'],
    },
    expected_citations: 0,
    tags: ['python', 'en', 'no-context'],
    notes:
      'FC-12 — context_mode none: khong gui payload context. Chi dung kien thuc pretrained, khong can tra web.',
  },
)

// ---------------------------------------------------------------------------

/** File snapshot rong cho nhom `general_qa` (context_mode none → khong gui). */
await writeFile(
  resolve(ROOT, 'apps/eval/dataset/snapshots/__no_context__.txt'),
  'Task nhom general_qa: context_mode = "none" → harness KHONG gui payload context.\nFile nay chi ton tai de snapshot_path tro dung → khong dung lam noi dung.\n',
  'utf8',
)

await writeFile(
  resolve(ROOT, 'apps/eval/dataset/tasks.json'),
  `${JSON.stringify(tasks, null, 2)}\n`,
  'utf8',
)

const byGroup = {}
const byLang = {}
for (const t of tasks) {
  byGroup[t.group] = (byGroup[t.group] ?? 0) + 1
  byLang[t.lang] = (byLang[t.lang] ?? 0) + 1
}
console.log(`Da sinh ${tasks.length} task.`)
console.log('Theo nhom:', byGroup)
console.log('Theo ngon ngu:', byLang)
