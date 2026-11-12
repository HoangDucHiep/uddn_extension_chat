/**
 * Bo thu thap snapshot cho eval dataset (T-M2-12).
 *
 * Chay 1 lan (`pnpm eval:collect`) de:
 *  1. Tai **trang that** (Wikipedia · developer.chrome.com · web.dev · MDN ·
 *     docs.python.org ...) va bien thanh snapshot text.
 *  2. Trich PDF + transcript YouTube qua **endpoint thu cua BFF**
 *     (`POST /api/extract/pdf` · `POST /api/extract/youtube`) → dung **dung
 *     duong dan san pham** ma nguoi dung thay (khong copy logic sang app
 *     eval → khong tach doi logic).
 *  3. Tai **anh** (nhom vision) vao `dataset/assets/` + ghi checksum.
 *  4. Sinh `dataset/dataset_meta.json` (version · nguon · license · checksum).
 *
 * Tinh chuan:
 *  - **Idempotent**: chay lai khong ghi de snapshot da co (tru khi `--force`).
 *  - **Khong** dung trang co noi dung dong → bo qua, ghi `error`.
 *  - Khong luu HTML goc → chi luu text (nhỏ + phuc vụ context LLM).
 *
 * Docs: docs/EVAL_PLAN.md §3.3, §3.4
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { htmlToText, sha256Content, snapshotPathFor, writeSnapshot } from './snapshot.js'

/** Thu muc goc cua app eval. */
const APP_ROOT = resolve(import.meta.dirname, '..')

/** Duong dan file meta (tuong doi repo root). */
export const DATASET_META_PATH = 'apps/eval/dataset/dataset_meta.json'

/** Thu muc chua asset nhi phan (anh). */
export const ASSET_DIR = 'apps/eval/dataset/assets'

/** User-Agent dung khi fetch trang that. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Timeout fetch trang (ms). */
const FETCH_TIMEOUT_MS = 20_000

/** Do dai toi thieu cua snapshot de co gia tri. */
const MIN_SNAPSHOT_CHARS = 200

/** Loai nguon can thu thap. */
export type SourceKind = 'html' | 'pdf' | 'youtube' | 'image'

/** Mot nguon can chup snapshot. */
export interface CollectSource {
  /** Slug → ten file snapshot (khong dau). */
  slug: string
  /** Loai nguon. */
  kind: SourceKind
  /** URL goc. */
  url: string
  /** Tieu de (dung khi trich that bai). */
  title: string
  /** Giay phep / nguon goc (ghi vao `dataset_meta.json`). */
  license: string
  /** Mo ta ngan — giup nguoi cham hieu task. */
  description?: string
  /** Ten file asset (chi dung khi `kind === 'image'`). */
  assetFileName?: string
}

/**
 * Danh sach nguon can thu thap.
 *
 * Chon trang **cong khai**, **tinh** (khong doi theo ngay) va co **so lieu
 * kiem chung duoc** → judge cham diem khong phai do "cam nhan".
 */
export const COLLECT_SOURCES: readonly CollectSource[] = [
  // --- Trang tieng Viet ---
  // Luu y: MDN `/vi/` **tu redirect sang en-US** khi trang chua co ban dich →
  // nguon VI chinh yeu la Chrome for Developers (`?hl=vi`, ban dich may)
  // + Kubernetes docs tieng Viet.
  {
    slug: 'chrome-vi-sidepanel',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel?hl=vi',
    title: 'chrome.sidePanel — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu Side Panel API của Chrome Extensions bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-tabs',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/tabs?hl=vi',
    title: 'chrome.tabs — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu Tabs API của Chrome Extensions bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-scripting',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/scripting?hl=vi',
    title: 'chrome.scripting — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu Scripting API của Chrome Extensions bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-storage',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/storage?hl=vi',
    title: 'chrome.storage — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu Storage API của Chrome Extensions bằng tiệt Việt.',
  },
  {
    slug: 'chrome-vi-windows',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/windows?hl=vi',
    title: 'chrome.windows — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu Windows API của Chrome Extensions bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-contextmenus',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/contextMenus?hl=vi',
    title: 'chrome.contextMenus — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu Context Menus API bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-mv3',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/develop/migrate?hl=vi',
    title: 'Di chuyển sang Manifest V3 — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Hướng dẫn chuyển từ Manifest V2 sang V3 bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-service-workers',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/develop/concepts/service-workers?hl=vi',
    title: 'Service worker của tiện ích — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Khái niệm service worker trong Chrome Extensions bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-content-scripts',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts?hl=vi',
    title: 'Tập lệnh nội dung — Chrome Extensions (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Tài liệu content script của Chrome Extensions bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-storage-buckets',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/web-platform/storage-buckets?hl=vi',
    title: 'Bộ chứa bộ nhớ — Chrome for Developers (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Bài viết về Storage Buckets bằng tiếng Việt.',
  },
  {
    slug: 'chrome-vi-lighthouse',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/lighthouse?hl=vi',
    title: 'Lighthouse — Chrome for Developers (tiếng Việt)',
    license: 'CC BY-SA 3.0',
    description: 'Giới thiệu Lighthouse bằng tiếng Việt.',
  },
  {
    slug: 'kubernetes-vi-overview',
    kind: 'html',
    url: 'https://kubernetes.io/vi/docs/concepts/overview/',
    title: 'Tổng quan — Kubernetes (tiếng Việt)',
    license: 'CC BY 4.0',
    description: 'Trang tổng quan Kubernetes bằng tiếng Việt.',
  },
  {
    slug: 'kubernetes-vi-service',
    kind: 'html',
    url: 'https://kubernetes.io/vi/docs/concepts/services-networking/service/',
    title: 'Service — Kubernetes (tiếng Việt)',
    license: 'CC BY 4.0',
    description: 'Khái niệm Service trong Kubernetes bằng tiếng Việt.',
  },
  {
    slug: 'kubernetes-vi-deployment',
    kind: 'html',
    url: 'https://kubernetes.io/vi/docs/concepts/workloads/controllers/deployment/',
    title: 'Deployments — Kubernetes (tiếng Việt)',
    license: 'CC BY 4.0',
    description: 'Khái niệm Deployment trong Kubernetes bằng tiếng Việt.',
  },
  {
    slug: 'kubernetes-vi-container',
    kind: 'html',
    url: 'https://kubernetes.io/vi/docs/concepts/containers/',
    title: 'Container — Kubernetes (tiếng Việt)',
    license: 'CC BY 4.0',
    description: 'Khái niệm Container trong Kubernetes bằng tiếng Việt.',
  },
  {
    slug: 'kubernetes-vi-memory',
    kind: 'html',
    url: 'https://kubernetes.io/vi/docs/tasks/configure-pod-container/assign-memory-resource/',
    title: 'Cấp phát tài nguyên bộ nhớ — Kubernetes (tiếng Việt)',
    license: 'CC BY 4.0',
    description: 'Hướng dẫn cấp phát bộ nhớ cho container bằng tiếng Việt.',
  },
  {
    slug: 'kubernetes-vi-tools',
    kind: 'html',
    url: 'https://kubernetes.io/vi/docs/tasks/tools/',
    title: 'Cài đặt các công cụ — Kubernetes (tiếng Việt)',
    license: 'CC BY 4.0',
    description: 'Hướng dẫn cài đặt kubectl bằng tiếng Việt.',
  },

  // --- Trang tieng Anh ---
  {
    slug: 'kubernetes-en-overview',
    kind: 'html',
    url: 'https://kubernetes.io/docs/concepts/overview/',
    title: 'Overview — Kubernetes',
    license: 'CC BY 4.0',
    description: 'Kubernetes overview.',
  },
  {
    slug: 'kubernetes-en-service',
    kind: 'html',
    url: 'https://kubernetes.io/docs/concepts/services-networking/service/',
    title: 'Service — Kubernetes',
    license: 'CC BY 4.0',
    description: 'Kubernetes Service concept.',
  },
  {
    slug: 'kubernetes-en-deployment',
    kind: 'html',
    url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
    title: 'Deployments — Kubernetes',
    license: 'CC BY 4.0',
    description: 'Kubernetes Deployment concept.',
  },
  {
    slug: 'kubernetes-en-container',
    kind: 'html',
    url: 'https://kubernetes.io/docs/concepts/containers/',
    title: 'Containers — Kubernetes',
    license: 'CC BY 4.0',
    description: 'Kubernetes Container concept.',
  },
  {
    slug: 'kubernetes-en-memory',
    kind: 'html',
    url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/',
    title: 'Assign Memory Resources — Kubernetes',
    license: 'CC BY 4.0',
    description: 'Assigning memory resources to containers.',
  },
  {
    slug: 'mdn-en-fetch-api',
    kind: 'html',
    url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API',
    title: 'Fetch API — MDN Web Docs',
    license: 'CC BY-SA 2.5',
    description: 'Fetch API documentation.',
  },
  {
    slug: 'mdn-en-http-headers',
    kind: 'html',
    url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers',
    title: 'HTTP headers — MDN Web Docs',
    license: 'CC BY-SA 2.5',
    description: 'HTTP headers reference.',
  },
  {
    slug: 'mdn-en-css-grid',
    kind: 'html',
    url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout',
    title: 'CSS grid layout — MDN Web Docs',
    license: 'CC BY-SA 2.5',
    description: 'CSS Grid Layout documentation.',
  },
  {
    slug: 'mdn-en-closures',
    kind: 'html',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures',
    title: 'Closures — MDN Web Docs',
    license: 'CC BY-SA 2.5',
    description: 'Closures in JavaScript.',
  },
  {
    slug: 'chrome-en-sidepanel',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/reference/api/sidePanel',
    title: 'chrome.sidePanel — Chrome Extensions',
    license: 'CC BY-SA 3.0',
    description: 'Side Panel API documentation.',
  },
  {
    slug: 'chrome-en-mv3',
    kind: 'html',
    url: 'https://developer.chrome.com/docs/extensions/develop/migrate',
    title: 'Migrate to Manifest V3 — Chrome Extensions',
    license: 'CC BY-SA 3.0',
    description: 'Migration guide to Manifest V3.',
  },
  {
    slug: 'webdev-lcp',
    kind: 'html',
    url: 'https://web.dev/articles/lcp',
    title: 'Largest Contentful Paint — web.dev',
    license: 'CC BY-SA 3.0',
    description: 'Guide to the LCP metric.',
  },
  {
    slug: 'webdev-service-worker',
    kind: 'html',
    url: 'https://web.dev/articles/service-worker-caching-and-http-caching',
    title: 'Service worker caching — web.dev',
    license: 'CC BY-SA 3.0',
    description: 'Caching strategies with service workers.',
  },
  {
    slug: 'wikipedia-en-sql',
    kind: 'html',
    url: 'https://en.wikipedia.org/wiki/SQL',
    title: 'SQL — Wikipedia',
    license: 'CC BY-SA 4.0',
    description: 'Overview of SQL.',
  },
  {
    slug: 'wikipedia-en-http',
    kind: 'html',
    url: 'https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol',
    title: 'Hypertext Transfer Protocol — Wikipedia',
    license: 'CC BY-SA 4.0',
    description: 'Overview of HTTP.',
  },
  {
    slug: 'react-thinking-in-react',
    kind: 'html',
    url: 'https://react.dev/learn/thinking-in-react',
    title: 'Thinking in React — react.dev',
    license: 'CC BY 4.0',
    description: 'Guide to breaking a UI into components.',
  },
  {
    slug: 'express-routing',
    kind: 'html',
    url: 'https://expressjs.com/en/guide/routing.html',
    title: 'Routing — Express',
    license: 'MIT',
    description: 'Express.js routing guide.',
  },
  {
    slug: 'postgresql-alter-table',
    kind: 'html',
    url: 'https://www.postgresql.org/docs/current/sql-altertable.html',
    title: 'ALTER TABLE — PostgreSQL',
    license: 'PostgreSQL License',
    description: 'Tài liệu lệnh ALTER TABLE của PostgreSQL.',
  },
  {
    slug: 'postgresql-string-functions',
    kind: 'html',
    url: 'https://www.postgresql.org/docs/current/functions-string.html',
    title: 'String Functions and Operators — PostgreSQL',
    license: 'PostgreSQL License',
    description: 'Tài liệu hàm toán xử lý chuỗi của PostgreSQL.',
  },
  {
    slug: 'postgresql-create-view',
    kind: 'html',
    url: 'https://www.postgresql.org/docs/current/sql-createview.html',
    title: 'CREATE VIEW — PostgreSQL',
    license: 'PostgreSQL License',
    description: 'Tài liệu lệnh CREATE VIEW của PostgreSQL.',
  },

  // --- PDF (nhom doc_extract) ---
  {
    slug: 'pdf-attention-is-all-you-need',
    kind: 'pdf',
    url: 'https://arxiv.org/pdf/1706.03762',
    title: 'Attention Is All You Need (PDF)',
    license: 'arXiv — CC BY 4.0',
    description: 'Bài báo "Attention Is All You Need" (Vaswani et al., 2017).',
  },
  {
    slug: 'pdf-bert',
    kind: 'pdf',
    url: 'https://arxiv.org/pdf/1810.04805',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers (PDF)',
    license: 'arXiv — CC BY 4.0',
    description: 'Bài báo về kiến trúc BERT (Devlin et al., 2018).',
  },

  // --- YouTube (nhom video_transcript) ---
  {
    slug: 'youtube-python-tutorial',
    kind: 'youtube',
    url: 'https://www.youtube.com/watch?v=rfscVS0vtbw',
    title: 'Learn Python - Full Course for Beginners (YouTube)',
    license: 'YouTube standard license',
    description: 'Khóa học Python dành cho người mới bắt đầu (tiếng Anh).',
  },
  {
    slug: 'youtube-js-event-loop',
    kind: 'youtube',
    url: 'https://www.youtube.com/watch?v=8aGhZQkoFbQ',
    title: 'The Event Loop (YouTube)',
    license: 'YouTube standard license',
    description: 'Video giải thích event loop trong JavaScript (tiếng Anh).',
  },

  // --- Anh (nhom vision) ---
  {
    slug: 'image-python-logo',
    kind: 'image',
    url: 'https://www.python.org/static/community_logos/python-logo-master-v3-TM.png',
    title: 'Python logo (python.org)',
    license: 'PSF',
    description: 'Logo chính thức của Python.',
    assetFileName: 'python-logo.png',
  },
  {
    slug: 'image-w3c-logo',
    kind: 'image',
    url: 'https://www.w3.org/Icons/w3c_main.png',
    title: 'W3C logo (w3.org)',
    license: 'W3C',
    description: 'Logo W3C.',
    assetFileName: 'w3c-logo.png',
  },
  {
    slug: 'image-postgresql-elephant',
    kind: 'image',
    url: 'https://www.postgresql.org/media/img/about/press/elephant.png',
    title: 'PostgreSQL elephant logo (postgresql.org)',
    license: 'PostgreSQL License',
    description: 'Logo hình con voi của PostgreSQL.',
    assetFileName: 'postgresql-elephant.png',
  },
  {
    slug: 'image-rust-logo',
    kind: 'image',
    url: 'https://www.rust-lang.org/logos/rust-logo-512x512.png',
    title: 'Rust logo (rust-lang.org)',
    license: 'CC BY 4.0',
    description: 'Logo chính thức của ngôn ngữ Rust.',
    assetFileName: 'rust-logo.png',
  },
]

/** Ket qua thu thap 1 nguon. */
export interface CollectResult {
  slug: string
  kind: SourceKind
  url: string
  title: string
  /** Duong dan snapshot tuong doi repo root (rong neu that bai). */
  snapshotPath: string
  /** Hash noi dung snapshot. */
  contentHash: string
  /** Do dai text (ky tu). */
  chars: number
  /** Duong dan asset (chi khi `kind === 'image'`). */
  assetPath?: string
  /** Kich thuoc asset goc (byte). */
  assetBytes?: number
  /** Loi neu that bai. */
  error?: string
}

/**
 * Trich text tu BFF (`POST /api/extract/*`).
 *
 * Dung endpoint **that cua san pham** → transcript/PDF trong dataset
 * giong het thu nguoi dung thay (khong copy logic sang app eval).
 *
 * @param baseUrl - Base URL cua BFF.
 * @param kind - Loai trich xuat.
 * @param url - URL nguon.
 */
async function extractViaBff(
  baseUrl: string,
  kind: 'pdf' | 'youtube',
  url: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/extract/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ kind, url }),
  })

  if (!response.ok) {
    throw new Error(`POST /api/extract/${kind} that bai: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as {
    text?: string
    error?: string
    errorMessage?: string
  }

  if (typeof payload.error === 'string' && payload.error.length > 0) {
    throw new Error(payload.errorMessage ?? payload.error)
  }

  return payload.text ?? ''
}

/**
 * Lay noi dung text cua 1 nguon.
 *
 * @param source - Nguon can thu thap.
 * @param baseUrl - Base URL cua BFF (dung cho pdf/youtube).
 */
async function extractSource(
  source: CollectSource,
  baseUrl: string,
): Promise<string | undefined> {
  switch (source.kind) {
    case 'html': {
      const html = await fetchText(source.url, langForSlug(source.slug))
      const text = htmlToText(html)
      return text.length >= MIN_SNAPSHOT_CHARS ? text : undefined
    }
    case 'pdf': {
      const text = await extractViaBff(baseUrl, 'pdf', source.url)
      return text.length >= MIN_SNAPSHOT_CHARS ? text : undefined
    }
    case 'youtube': {
      const text = await extractViaBff(baseUrl, 'youtube', source.url)
      return text.length >= MIN_SNAPSHOT_CHARS ? text : undefined
    }
    case 'image':
      // Anh khong co text → snapshot la mo ta + checksum file.
      return `[IMAGE] ${source.title}\n${source.description ?? ''}`.trim()
    default:
      return undefined
  }
}

/**
 * Ngon ngu cua 1 nguon thu thap.
 *
 * Trang "tieng Viet" dung `?hl=vi` (Chrome for Developers) hoac ban dich
 * chinh thuc (Kubernetes) → can `Accept-Language: vi`.
 * Trang "tieng Anh" **phai** `Accept-Language: en-US` → neu de mac dinh
 * `vi,en` thi trang se tra ve ban dich may tieng Viet (vi du web.dev).
 */
export type SourceLang = 'vi' | 'en'

/**
 * Suy ra ngon ngu tu slug nguon.
 *
 * Quy tac: slug chua `-vi-` → 'vi'; con lai → 'en'.
 *
 * @param slug - Slug nguon.
 */
export function langForSlug(slug: string): SourceLang {
  return slug.includes('-vi-') ? 'vi' : 'en'
}

/**
 * Header `Accept-Language` cho tung ngon ngu.
 *
 * @param lang - Ngon ngu can fetch.
 */
function acceptLanguage(lang: SourceLang): string {
  return lang === 'vi' ? 'vi-VN,vi;q=0.9' : 'en-US,en;q=0.9'
}

/**
 * Fetch URL va tra ve body dang text.
 *
 * @param url - URL can tai.
 */
async function fetchText(url: string, lang: SourceLang): Promise<string> {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: 'text/html,*/*', 'Accept-Language': acceptLanguage(lang) },
  })
  return response.text()
}

/**
 * Fetch URL va tra ve body dang byte (dung cho anh).
 *
 * @param url - URL can tai.
 */
async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetchWithTimeout(url, { headers: { Accept: 'image/*,*/*' } })
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? '',
  }
}

/**
 * Fetch co timeout + User-Agent giong trinh duyet.
 *
 * @param url - URL can tai.
 * @param init - Tuy chon fetch.
 */
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        ...(init.headers as Record<string, string> | undefined),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Thu thap **tat ca** nguon trong `COLLECT_SOURCES`.
 *
 * Khong abort khi 1 nguon that bai → ghi `error` va tiep tuc.
 *
 * @param options - Tuy chon.
 * @param options.force - Ghi lai snapshot du hash da doi (mac dinh `false`).
 * @param options.baseUrl - Base URL cua BFF (dung cho pdf/youtube).
 */
export async function collectAll(
  options: { force?: boolean; baseUrl?: string } = {},
): Promise<CollectResult[]> {
  const baseUrl = options.baseUrl ?? 'http://127.0.0.1:8787'
  const results: CollectResult[] = []

  for (const source of COLLECT_SOURCES) {
    const snapshotPath = snapshotPathFor(source.slug)

    try {
      const text = await extractSource(source, baseUrl)
      if (text === undefined) {
        results.push({
          slug: source.slug,
          kind: source.kind,
          url: source.url,
          title: source.title,
          snapshotPath,
          contentHash: '',
          chars: 0,
          error: 'Noi dung qua ngan hoac rong',
        })
        continue
      }

      const contentHash = sha256Content(text)

      if (source.kind === 'image') {
        // Anh khong co text → snapshot la mo ta + checksum file.
        // Van ghi file snapshot de `dataset_meta.json` + task tro dung duong dan.
        await writeSnapshot(snapshotPath, text)
        const asset = await downloadImage(source)
        results.push({
          slug: source.slug,
          kind: source.kind,
          url: source.url,
          title: source.title,
          snapshotPath,
          contentHash,
          chars: text.length,
          ...(asset !== undefined ? asset : {}),
        })
        continue
      }

      const existing = await readExisting(snapshotPath)
      if (existing !== undefined && existing.contentHash !== contentHash) {
        if (options.force !== true) {
          results.push({
            slug: source.slug,
            kind: source.kind,
            url: source.url,
            title: source.title,
            snapshotPath,
            contentHash: existing.contentHash,
            chars: existing.chars,
            error: 'Noi dung nguon da doi — giu snapshot cu (dung --force de ghi de)',
          })
          continue
        }
      }

      await writeSnapshot(snapshotPath, text)
      results.push({
        slug: source.slug,
        kind: source.kind,
        url: source.url,
        title: source.title,
        snapshotPath,
        contentHash,
        chars: text.length,
      })
    } catch (error) {
      results.push({
        slug: source.slug,
        kind: source.kind,
        url: source.url,
        title: source.title,
        snapshotPath,
        contentHash: '',
        chars: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}

/**
 * Tai anh vao `dataset/assets/`.
 *
 * @param source - Nguon anh.
 * @returns Duong dan asset + kich thuoc, hoac `undefined` neu that bai.
 */
async function downloadImage(
  source: CollectSource,
): Promise<{ assetPath: string; assetBytes: number } | undefined> {
  if (source.assetFileName === undefined) return undefined

  const { bytes, contentType } = await fetchBytes(source.url)
  if (bytes.byteLength === 0) return undefined

  // Trang loi 404/redirect thuong tra ve HTML → phai loai, khong ghi file.
  if (!contentType.startsWith('image/')) {
    throw new Error(`Khong phai anh (Content-Type: ${contentType || 'unknown'})`)
  }

  const relativePath = `${ASSET_DIR}/${source.assetFileName}`
  const absolute = resolve(APP_ROOT, '..', '..', relativePath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, bytes)

  return { assetPath: relativePath, assetBytes: bytes.byteLength }
}

/** Snapshot da co tren dia chi. */
async function readExisting(
  relativePath: string,
): Promise<{ contentHash: string; chars: number } | undefined> {
  try {
    const raw = await readFile(resolve(APP_ROOT, '..', '..', relativePath), 'utf8')
    return { contentHash: sha256Content(raw), chars: raw.length }
  } catch {
    return undefined
  }
}

/**
 * Sinh `dataset/dataset_meta.json`.
 *
 * @param results - Ket qua thu thap.
 */
export async function writeDatasetMeta(results: readonly CollectResult[]): Promise<void> {
  const sources = results.map((result) => {
    const source = COLLECT_SOURCES.find((item) => item.slug === result.slug)
    return {
      slug: result.slug,
      kind: result.kind,
      url: result.url,
      title: result.title,
      license: source?.license ?? 'unknown',
      ...(source?.description !== undefined ? { description: source.description } : {}),
      snapshot_path: result.snapshotPath,
      content_hash: result.contentHash,
      chars: result.chars,
      ...(result.assetPath !== undefined ? { asset_path: result.assetPath } : {}),
      ...(result.assetBytes !== undefined ? { asset_bytes: result.assetBytes } : {}),
      ...(result.error !== undefined ? { error: result.error } : {}),
    }
  })

  const payload = {
    version: '1.0.0',
    collectedAt: new Date().toISOString(),
    collector: 'apps/eval collect',
    note:
      'Snapshot la noi dung trang tai thoi diem thu thap — harness doc snapshot ' +
      'chứ KHONG doc trang live (FC-2 trong EVAL_PLAN.md §9).',
    datasetChecksum: createHash('sha256')
      .update(sources.map((item) => `${item.slug}:${item.content_hash}`).join('\n'))
      .digest('hex'),
    sources,
  }

  const absolute = resolve(APP_ROOT, '..', '..', DATASET_META_PATH)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}
