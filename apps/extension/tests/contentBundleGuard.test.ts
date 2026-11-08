import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

/**
 * Guard hạ tầng test: **content script** (`dist/content.js`) phải giữ nhỏ.
 *
 * ## Vì sao cần guard này?
 *
 * Content script chạy trong **mọi** trang web user mở → bundle phình ảnh
 * hưởng trực tiếp tới tốc độ load trang. Ngưỡng lịch sử: **13.87 kB**
 * (M0 → T-M1-14).
 *
 * Đã có **2 lần hồi quy** làm bundle phình mà không ai để ý:
 * - **T-M1-17** — `lib/i18n.ts` → `lib/settings.ts` → `@sidekick/shared`
 *   (index) → **Zod** → 13.87 kB → **147.85 kB**.
 * - **T-M1-20** — `lib/i18n.ts` → `i18n/index.ts` → dictionary đầy đủ
 *   (~34 kB) → **~46 kB**.
 *
 * Cả 2 đều **không** làm hỏng chức năng → test chức năng vẫn xanh →
 * chỉ guard này bắt được.
 *
 * Guard gồm 2 phần:
 * 1. **Source-level** — content script **không** được import Zod / React /
 *    dictionary đầy đủ (bắt lỗi **trước** khi build).
 * 2. **Bundle-level** — nếu `dist/content.js` đã có thì assert kích thước.
 *
 * ## Vì sao là **đồ thị phụ thuộc**, không phải grep từng file?
 *
 * Lần đầu guard này chỉ grep **trực tiếp** trong `src/content/*.ts` →
 * **lọt lưới**: đổi `contentScript.ts` sang import `../lib/i18n.js` vẫn
 * xanh, dù `lib/i18n.js` kéo theo dictionary đầy đủ. Vì vậy guard phải
 * **duyệt đệ quy** toàn bộ module mà content script kéo theo, rồi mới
 * phán quyết.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.5
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = resolve(HERE, '..', 'src')
const DIST_CONTENT = resolve(HERE, '..', 'dist', 'content.js')

/** Ngưỡng kích thước `dist/content.js` (byte). */
const MAX_CONTENT_BYTES = 40 * 1024

/** Entry point của content script (IIFE bundle). */
const CONTENT_ENTRY = resolve(SRC_DIR, 'content', 'contentScript.ts')

/**
 * Module **được phép** import `@sidekick/shared` — chỉ subpath hằng (không
 * kéo theo barrel `index` → Zod).
 */
const SHARED_ALLOWED_SUBPATHS = ['@sidekick/shared/constants']

/**
 * Module **được phép** dùng trong bundle ngoài panel (dictionary đầy đủ).
 *
 * `lib/i18n.ts` + `i18n/index.ts` là nguồn của dictionary **~34 kB** → tuyệt
 * đối không được nằm trong đồ thị phụ thuộc của content script.
 */
const FULL_DICTIONARY_MODULES = [
  'lib/i18n.ts',
  'i18n/index.ts',
  'i18n/vi.ts',
  'i18n/en.ts',
]

/** Đuôi file nguồn hợp lệ. */
const SOURCE_EXTENSIONS = ['.ts', '.tsx'] as const

/**
 * Liệt kê file nguồn trong 1 thư mục (không đệ quy).
 *
 * @param dir - Thư mục cần quét.
 * @returns Danh sách đường dẫn tuyệt đối.
 */
function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return listSourceFiles(full)
    if (!SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) return []
    return [full]
  })
}

/**
 * Đọc nội dung 1 file nguồn.
 *
 * @param path - Đường dẫn tuyệt đối.
 * @returns Nội dung file.
 */
function readSource(path: string): string {
  return readFileSync(path, 'utf8')
}

/**
 * Chuyển 1 specifier trong source thành đường dẫn file tuyệt đối.
 *
 * Hỗ trợ: đường dẫn tương đối (`./x`, `../x`), alias Vite (`@/x`),
 * và file nguồn nội bộ (`@sidekick/shared` — không theo dõi).
 *
 * @param specifier - Specifier trong lệnh import.
 * @param importer - File đang import (để resolve đường dẫn tương đối).
 * @returns Đường dẫn tuyệt đối, hoặc `null` nếu không theo dõi được.
 */
function resolveImport(specifier: string, importer: string): string | null {
  let base: string

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = resolve(dirname(importer), specifier)
  } else if (specifier.startsWith('@/')) {
    base = resolve(SRC_DIR, specifier.slice(2))
  } else {
    // Bare specifier (`react`, `@sidekick/shared`, `zod`…) → không theo dõi.
    return null
  }

  // Quy ước import nội bộ: dùng đuôi `.js` dù file nguồn là `.ts`.
  // → Phải bỏ đuôi `.js` trước khi thử các candidate bên dưới.
  const withoutJsExtension = base.endsWith('.js') ? base.slice(0, -'.js'.length) : base

  const candidates = [
    base,
    withoutJsExtension,
    ...SOURCE_EXTENSIONS.map((ext) => `${withoutJsExtension}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => join(withoutJsExtension, `index${ext}`)),
  ]

  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      // Không tồn tại → thử candidate tiếp theo.
    }
  }

  return null
}

/**
 * Trích **value import** của 1 file nguồn.
 *
 * > `import type { X } from 'y'` và `import { type X } from 'y'` bị **xoá
 * > khi build** (verbatimModuleSyntax / esbuild) → **không** ảnh hưởng
 * > bundle → guard không được báo động giả vì chúng.
 *
 * @param source - Nội dung file.
 * @returns Danh sách specifier của các import **có giá trị runtime**.
 */
function valueImportSpecifiers(source: string): string[] {
  const specifiers: string[] = []

  // `import type { X } from 'y'` / `import type X from 'y'` → bỏ qua.
  const withoutTypeOnly = source.replace(/import\s+type\s+[^;]*?from\s+['"]([^'"]+)['"];?/g, '')

  const importRegex = /import\s+([\s\S]*?)\s*from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null

  while ((match = importRegex.exec(withoutTypeOnly)) !== null) {
    const clause = match[1] ?? ''
    const specifier = match[2]
    if (specifier === undefined) continue

    // `import { type A, B }` → `B` là value → giữ.
    const named = clause.match(/\{([\s\S]*)\}/)
    if (named !== null) {
      const entries = (named[1] ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.startsWith('type '))
      if (entries.length === 0) continue
    } else {
      // `import Default from 'y'` → value. `import * as ns from 'y'` → value.
      const trimmed = clause.trim()
      if (trimmed.length === 0) continue
    }

    specifiers.push(specifier)
  }

  return specifiers
}

/**
 * Duyệt **đệ quy** đồ thị phụ thuộc của 1 entry point.
 *
 * @param entry - File entry point.
 * @returns Tập đường dẫn tuyệt đối của mọi module reachable.
 */
function dependencyGraph(entry: string): Set<string> {
  const visited = new Set<string>()
  const queue: string[] = [entry]

  while (queue.length > 0) {
    const current = queue.pop()
    if (current === undefined || visited.has(current)) continue
    visited.add(current)

    const source = readSource(current)

    for (const specifier of valueImportSpecifiers(source)) {
      const resolved = resolveImport(specifier, current)
      if (resolved !== null && !visited.has(resolved)) queue.push(resolved)
    }
  }

  return visited
}

/**
 * Tìm các file trong đồ thị **có** import value tới 1 specifier cụ thể.
 *
 * @param graph - Đồ thị phụ thuộc.
 * @param specifier - Specifier cần tìm (vd `@sidekick/shared`).
 * @returns Danh sách file phạm lỗi.
 */
function filesImporting(graph: Set<string>, specifier: string): string[] {
  return [...graph].filter((path) => {
    return valueImportSpecifiers(readSource(path)).includes(specifier)
  })
}

/** Đồ thị phụ thuộc của content script (tính 1 lần cho cả file test). */
const CONTENT_GRAPH = dependencyGraph(CONTENT_ENTRY)

describe('guard: do thi phu thuoc cua content script', () => {
  it('content script khong keo theo module "@sidekick/shared" (barrel → Zod)', () => {
    expect(filesImporting(CONTENT_GRAPH, '@sidekick/shared')).toEqual([])
  })

  it('content script khong import module "@sidekick/shared" khong phai subpath constants', () => {
    const offenders = [...CONTENT_GRAPH].filter((path) => {
      const specifiers = valueImportSpecifiers(readSource(path)).filter((spec) =>
        spec.startsWith('@sidekick/shared'),
      )
      return specifiers.some((spec) => !SHARED_ALLOWED_SUBPATHS.includes(spec))
    })

    expect(offenders).toEqual([])
  })

  it('content script khong keo theo dictionary DAY DU (chi duoc dung dictionary rut gon)', () => {
    const forbidden = new Set(
      FULL_DICTIONARY_MODULES.map((rel) => resolve(SRC_DIR, ...rel.split('/'))),
    )
    const offenders = [...CONTENT_GRAPH].filter((path) => forbidden.has(path))

    expect(offenders).toEqual([])
  })

  it('content script khong keo theo React', () => {
    expect(filesImporting(CONTENT_GRAPH, 'react')).toEqual([])
  })

  it('content script khong keo theo Zod ( truc tiep hoac qua "@sidekick/shared")', () => {
    expect(filesImporting(CONTENT_GRAPH, 'zod')).toEqual([])
  })
})

describe('guard: kich thuoc dist/content.js', () => {
  it('neu da build → khong vuot nguong 40 kB', () => {
    let size: number
    try {
      size = statSync(DIST_CONTENT).size
    } catch {
      // Chua build → bo qua (guard source-level o tren van chay).
      return
    }

    expect(size).toBeLessThanOrEqual(MAX_CONTENT_BYTES)
  })

  it('neu da build → khong chua Zod (khong co "invalid_type")', () => {
    let content: string
    try {
      content = readFileSync(DIST_CONTENT, 'utf8')
    } catch {
      return
    }

    expect(content).not.toContain('invalid_type')
  })
})

describe('guard: bien do kich thuoc bundle', () => {
  it('module "ngoai panel" chi duoc dung dictionary rut gon', () => {
    // `i18n/outsidePanel.ts` la nguon su that cho 4 khoa ngoai panel.
    const source = readSource(resolve(SRC_DIR, 'i18n', 'outsidePanel.ts'))
    expect(source).not.toMatch(/from\s+['"][^'"]*\/i18n['"]/)
    expect(source).toContain("from './outsidePanel.vi.js'")
    expect(source).toContain("from './outsidePanel.en.js'")
  })

  it('danh sach khoa "ngoai panel" khop voi dictionary rut gon', () => {
    const surface = readSource(resolve(SRC_DIR, 'i18n', 'surface.ts'))
    const vi = readSource(resolve(SRC_DIR, 'i18n', 'outsidePanel.vi.ts'))
    const en = readSource(resolve(SRC_DIR, 'i18n', 'outsidePanel.en.ts'))

    // Moi khoa trong VI phai xuat hien trong EN (dung chieu khoa).
    const viKeys = [...vi.matchAll(/^\s{2}'?([\w.]+)'?:\s/gm)].map((m) => m[1])
    for (const key of viKeys) {
      expect(en).toContain(`'${key}':`)
    }

    // `surface.ts` phai lay danh sach tu dictionary VI (nguon su that).
    expect(surface).toContain("from './outsidePanel.vi.js'")
  })
})

describe('guard: kiem tra file nguon ton tai', () => {
  it('khong phai file rong trong src/content', () => {
    const empty = listSourceFiles(resolve(SRC_DIR, 'content')).filter((path) => {
      return readSource(path).trim().length === 0
    })

    expect(empty).toEqual([])
  })
})
