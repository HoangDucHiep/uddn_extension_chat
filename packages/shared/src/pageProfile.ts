/**
 * Phan loai trang theo "ngu canh dung" + bo goi y theo loai trang (T-M1-11).
 *
 * Khac voi `pageKind.ts`:
 *  - `pageKind` phuc vu **dinh tuyen trich xuat** (`html` / `pdf` / `youtube`).
 *  - `pageProfile` phuc vu **chon goi y UI** (docs / article / forum / video /
 *    shopping / general) → FR-UX-03 / FR-UX-04.
 *
 * Hai lop nay tach biet de viec them loai trang moi khong lam hong routing
 * trich xuat (va nguoc lai).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.12
 */

import { extractYouTubeVideoId, isPdfUrl } from './pageKind.js'

/** Cac loai trang (ngu canh dung) ma ta phan biet duoc. */
export const PAGE_PROFILES = [
  'docs',
  'article',
  'forum',
  'video',
  'pdf',
  'shopping',
  'general',
] as const

export type PageProfile = (typeof PAGE_PROFILES)[number]

/** Mot goi y cau hoi (FR-UX-03 / FR-UX-04). */
export interface PromptSuggestion {
  /** Id dinh danh goi y — duy nhat trong 1 bo goi y. */
  id: string
  /** Nhan ngan hien thi tren chip. */
  label: string
  /** Prompt day du se gui len BFF (da dien `{title}`). */
  prompt: string
}

/** Placeholder ten trang — duoc dien khi tao goi y. */
const TITLE_PLACEHOLDER = '{title}'

/** Host cua trang forum / Q&A. */
const FORUM_HOSTS = new Set([
  'stackoverflow.com',
  'superuser.com',
  'serverfault.com',
  'askubuntu.com',
  'stackexchange.com',
  'reddit.com',
  'quora.com',
  'news.ycombinator.com',
  'discourse.org',
  'php.net',
])

/** Host cua trang tai lieu / API docs. */
const DOCS_HOSTS = new Set([
  'developer.mozilla.org',
  'readthedocs.io',
  'readthedocs.org',
  'docs.python.org',
  'nodejs.org',
  'typescriptlang.org',
  'react.dev',
  'vuejs.org',
  'angular.io',
  'golang.org',
  'rust-lang.org',
  'developer.chrome.com',
  'developer.apple.com',
  'learn.microsoft.com',
  'docs.oracle.com',
  'kubernetes.io',
  'docker.com',
])

/** Host cua trang bai bao / blog / paper. */
const ARTICLE_HOSTS = new Set([
  'arxiv.org',
  'medium.com',
  'substack.com',
  'wikipedia.org',
  'blog.google',
  'techcrunch.com',
  'theverge.com',
  'vnexpress.net',
  'tuoitre.vn',
])

/** Host cua trang ban hang. */
const SHOPPING_HOSTS = new Set([
  'amazon.com',
  'amazon.vn',
  'shopify.com',
  'shopee.vn',
  'lazada.vn',
  'tiki.vn',
  'ebay.com',
  'etsy.com',
])

/** Host cua trang video (khong phai YouTube). */
const VIDEO_HOSTS = new Set([
  'vimeo.com',
  'twitch.tv',
  'tiktok.com',
  'dailymotion.com',
  'odysee.com',
])

/** Path segment gan voi tung loai trang. */
const DOCS_PATHS = [
  '/docs/',
  '/documentation/',
  '/api/',
  '/reference/',
  '/guide/',
  '/guides/',
  '/manual/',
  '/tutorial/',
  '/tutorials/',
]

const FORUM_PATHS = ['/forum/', '/community/', '/questions/', '/discussion/', '/showthread.php']

const ARTICLE_PATHS = ['/blog/', '/post/', '/article/', '/articles/', '/news/', '/blog-post/']

const SHOPPING_PATHS = ['/product/', '/products/', '/shop/', '/cart/']

/**
 * Chuan hoa host: bo `www.` va lowercase.
 *
 * @param hostname - Host tu URL.
 */
function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

/**
 * Kiem tra path co chua mot segment duoc liet ke hay khong.
 *
 * @param path - Pathname cua URL.
 * @param segments - Danh sach segment can kiem tra.
 */
function hasPath(path: string, segments: readonly string[]): boolean {
  return segments.some((segment) => path.includes(segment))
}

/**
 * Phan loai trang theo ngu canh dung.
 *
 * Thu tu kiem tra (match dau thang):
 *  1. `pdf`  — URL ket thuc `.pdf`.
 *  2. `video` — YouTube + cac host video khac.
 *  3. `forum` — host Q&A / duong dan forum.
 *  4. `docs`  — host tai lieu / duong dan docs.
 *  5. `article` — host blog/paper / duong dan bai bao.
 *  6. `shopping` — host ban hang / duong dan san pham.
 *  7. `general` — fallback (ke ca trang `chrome://`).
 *
 * @param url - URL trang dang mo.
 * @param title - Tieu de trang (fallback khi khong khop host/path).
 */
export function classifyPage(url: string, title = ''): PageProfile {
  if (url.length === 0) return 'general'

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'general'
  }

  // Trang noi bo trinh duyet (`chrome://`, `file://`) → khong co goi y theo trang.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'general'

  if (isPdfUrl(url)) return 'pdf'
  if (extractYouTubeVideoId(url) !== undefined) return 'video'

  const host = normalizeHost(parsed.hostname)
  const path = parsed.pathname.toLowerCase()
  const lowerTitle = title.toLowerCase()

  if (FORUM_HOSTS.has(host) || hasPath(path, FORUM_PATHS)) return 'forum'
  if (DOCS_HOSTS.has(host) || hasPath(path, DOCS_PATHS)) return 'docs'
  if (host.startsWith('docs.') || host.startsWith('developer.')) return 'docs'
  if (host === 'github.com' && path.includes('/blob')) return 'docs'
  if (ARTICLE_HOSTS.has(host) || hasPath(path, ARTICLE_PATHS)) return 'article'
  if (SHOPPING_HOSTS.has(host) || hasPath(path, SHOPPING_PATHS)) return 'shopping'
  if (VIDEO_HOSTS.has(host)) return 'video'

  // Fallback theo tieu de — trang docs nhieu nguoi viet "documentation" trong title.
  if (lowerTitle.includes('documentation') || lowerTitle.includes('reference')) return 'docs'
  if (lowerTitle.includes('forum') || lowerTitle.includes('community')) return 'forum'

  return 'general'
}

/**
 * Dien placeholder `{title}` bang ten trang that.
 *
 * Ten trang rong → bo placeholder, dung ten chung.
 *
 * @param template - Prompt co placeholder.
 * @param pageTitle - Ten trang.
 */
function fillTitle(template: string, pageTitle: string): string {
  const title = pageTitle.trim()
  if (title.length === 0) return template.replace(TITLE_PLACEHOLDER, 'trang này')
  return template.replaceAll(TITLE_PLACEHOLDER, title)
}

/** Tao danh sach goi y tu mau (prompt co `{title}`). */
function buildSuggestions(
  profile: PageProfile,
  templates: readonly { id: string; label: string; prompt: string }[],
  pageTitle: string,
): PromptSuggestion[] {
  return templates.map((template) => ({
    id: template.id,
    label: template.label,
    prompt: fillTitle(template.prompt, pageTitle),
  }))
}

/** Mau goi y cho tung profile. */
const PROFILE_TEMPLATES: Record<
  Exclude<PageProfile, 'general'>,
  readonly { id: string; label: string; prompt: string }[]
> = {
  docs: [
    {
      id: 'docs-explain',
      label: 'Giải thích dễ hiểu',
      prompt:
        'Giải thích {title} bằng ví dụ code tối thiểu, giải thích từng bước và nêu các trường hợp thường gặp.',
    },
    {
      id: 'docs-install',
      label: 'Tóm tắt cách cài đặt',
      prompt:
        'Tóm tắt các bước cài đặt và thiết lập trong {title}, theo thứ tự thực hiện, kèm lệnh mẫu.',
    },
    {
      id: 'docs-params',
      label: 'Liệt kê tham số',
      prompt:
        'Liệt kê các tham số / tuỳ chọn quan trọng của {title}, cho biết kiểu dữ liệu, giá trị mặc định và khi nào nên đổi.',
    },
    {
      id: 'docs-compare',
      label: 'So sánh cách làm',
      prompt:
        'So sánh {title} với cách làm đơn giản hơn: khi nào nên dùng, ưu nhược điểm và ví dụ thực tế.',
    },
  ],
  article: [
    {
      id: 'article-summary',
      label: 'Tóm tắt 5 ý chính',
      prompt:
        'Tóm tắt {title} thành 5 ý chính, nêu 2 con số nổi bật và 1 câu hỏi mà bài viết chưa trả lời.',
    },
    {
      id: 'article-arguments',
      label: 'Luận điểm chính',
      prompt:
        'Nêu luận điểm chính và cách lập luận của {title}, đồng thời chỉ ra điểm yếu hoặc giới hạn của bài.',
    },
    {
      id: 'article-keyquotes',
      label: 'Trích dẫn hay',
      prompt:
        'Trích ra 3 câu đáng chú ý nhất trong {title} và giải thích ngắn vì sao chúng quan trọng.',
    },
    {
      id: 'article-apply',
      label: 'Áp dụng cho tôi',
      prompt:
        'Dựa trên {title}, đề xuất cách áp dụng ý tưởng đó vào một dự án thực tế, nêu rõ bước đầu tiên.',
    },
  ],
  forum: [
    {
      id: 'forum-answer',
      label: 'Tóm tắt đáp án',
      prompt:
        'Tóm tắt các đáp án được đánh giá cao nhất trong {title}, kèm lý do và đoạn code quan trọng.',
    },
    {
      id: 'forum-solution',
      label: 'Rút lỗi thường gặp',
      prompt:
        'Trong {title}, các lỗi thường gặp và nguyên nhân gốc rễ là gì? Liệt kê theo thứ tự dễ gặp nhất.',
    },
    {
      id: 'forum-clarify',
      label: 'Giải thích dễ hiểu',
      prompt:
        'Giải thích câu hỏi trong {title} cho người mới, dùng ví dụ đời thường và tránh thuật ngữ khó.',
    },
    {
      id: 'forum-verify',
      label: 'Kiểm chứng đáp án',
      prompt:
        'Kiểm chứng đáp án trong {title} còn đúng không với phiên bản hiện tại, và chỉ ra chỗ nào đã lỗi thời.',
    },
  ],
  video: [
    {
      id: 'video-summary',
      label: 'Tóm tắt video',
      prompt:
        'Tóm tắt nội dung video này thành 5 ý chính theo trình tự, kèm mốc thời gian quan trọng nếu có.',
    },
    {
      id: 'video-actions',
      label: 'Bước thực hành',
      prompt:
        'Trích ra các bước thực hành / thao tác được hướng dẫn trong video, dạng checklist ngắn gọn.',
    },
    {
      id: 'video-questions',
      label: 'Câu hỏi chưa có đáp án',
      prompt: 'Video này bỏ sót điều gì? Nêu 3 câu hỏi phần video chưa trả lời.',
    },
    {
      id: 'video-quotes',
      label: 'Trích dẫn đáng nhớ',
      prompt: 'Trích 3 câu đáng nhớ nhất trong video và giải thích ngắn ý nghĩa của từng câu.',
    },
  ],
  pdf: [
    {
      id: 'pdf-summary',
      label: 'Tóm tắt tài liệu',
      prompt:
        'Tóm tắt tài liệu này thành 5 ý chính, nêu 2 con số nổi bật và 1 kết luận chính.',
    },
    {
      id: 'pdf-keypoints',
      label: 'Ý chính theo mục',
      prompt: 'Liệt kê các ý chính theo từng mục / chương của tài liệu, giữ nguyên thuật ngữ gốc.',
    },
    {
      id: 'pdf-terms',
      label: 'Giải thích thuật ngữ',
      prompt:
        'Giải thích các thuật ngữ chuyên ngành xuất hiện trong tài liệu, mỗi thuật ngữ kèm 1 ví dụ cụ thể.',
    },
    {
      id: 'pdf-findings',
      label: 'Phát hiện đáng chú ý',
      prompt:
        'Trong tài liệu này, phát hiện đáng chú ý nào về phương pháp, kết quả hoặc hạn chế? Nêu rõ lý do.',
    },
  ],
  shopping: [
    {
      id: 'shopping-compare',
      label: 'So sánh lựa chọn',
      prompt:
        'So sánh các lựa chọn trên trang này về giá, tính năng và phù hợp với nhu cầu tối giản.',
    },
    {
      id: 'shopping-checklist',
      label: 'Checklist trước khi mua',
      prompt:
        'Trước khi mua sản phẩm trên trang này, tôi cần kiểm tra những gì? Đưa ra checklist ngắn gọn.',
    },
    {
      id: 'shopping-hidden-cost',
      label: 'Chi phí ẩn',
      prompt: 'Có chi phí ẩn nào trong lựa chọn này không (phí vận chuyển, phụ kiện, bảo hành)? Nêu rõ.',
    },
    {
      id: 'shopping-alternative',
      label: 'Gợi ý thay thế',
      prompt:
        'Dựa trên tiêu chí từ trang này, gợi ý 2 lựa chọn thay thế đáng cân nhắc và nêu điểm đổi lợi.',
    },
  ],
}

/** Goi y chung — dung khi khong co trang nao de dinh ung (FR-UX-04). */
const GENERAL_TEMPLATES: readonly { id: string; label: string; prompt: string }[] = [
  {
    id: 'general-explain',
    label: 'Giải thích khái niệm',
    prompt: 'Giải thích khái niệm này bằng ví dụ đời thường, tránh thuật ngữ khó.',
  },
  {
    id: 'general-code',
    label: 'Viết đoạn code',
    prompt:
      'Viết đoạn code tối giản cho yêu cầu này, kèm chú thích và 1 ví dụ đầu vào / đầu ra.',
  },
  {
    id: 'general-compare',
    label: 'So sánh 2 phương án',
    prompt: 'So sánh 2 phương án cho bài toán này: ưu nhược điểm, khi nào nên chọn cái nào.',
  },
  {
    id: 'general-plan',
    label: 'Lập kế hoạch',
    prompt: 'Lập kế hoạch 5 bước để hoàn thành việc này, kèm tiêu chí nghe-thành-công ở mỗi bước.',
  },
]

/**
 * Bo goi y theo loai trang (FR-UX-03).
 *
 * Moi profile co **it nhat 3** goi y. `pageTitle` rong → dung ten chung.
 *
 * @param profile - Loai trang da phan loai.
 * @param pageTitle - Tieu de trang dang mo.
 */
export function suggestionsForPage(
  profile: PageProfile,
  pageTitle: string,
): PromptSuggestion[] {
  if (profile === 'general') return generalSuggestions()
  return buildSuggestions(profile, PROFILE_TEMPLATES[profile], pageTitle)
}

/**
 * Bo goi y chung — dung khi khong co trang nao de dinh ung (FR-UX-04).
 */
export function generalSuggestions(): PromptSuggestion[] {
  return buildSuggestions('general', GENERAL_TEMPLATES, '')
}

/**
 * Xoay vong bo goi y hien tai (nut "lam moi").
 *
 * Dinh determin (offset tang 1) → test on dinh, khong flaky.
 *
 * @param suggestions - Bo goi y hien tai.
 * @param offset - Buoc xoay.
 */
export function rotateSuggestions(
  suggestions: readonly PromptSuggestion[],
  offset: number,
): PromptSuggestion[] {
  if (suggestions.length === 0) return []
  const shift = ((offset % suggestions.length) + suggestions.length) % suggestions.length
  return [...suggestions.slice(shift), ...suggestions.slice(0, shift)]
}
