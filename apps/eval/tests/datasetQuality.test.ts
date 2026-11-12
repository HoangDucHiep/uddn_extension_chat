import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVAL_GROUPS, evalTaskListSchema } from '@sidekick/shared'
import { loadDataset } from '../src/dataset.js'
import { sha256Content } from '../src/snapshot.js'

/**
 * Test chat luong dataset that (T-M2-12).
 *
 * AC theo [`EVAL_PLAN.md`](../../../docs/EVAL_PLAN.md) §3.2 + §12:
 *  - Dataset co it nhat **52 task**, du **8 nhom** va **8 task moi nhom**.
 *  - ≥ 80% task co `reference.must_include_facts`.
 *  - ≥ 40% task tieng Viet · **moi nhom** co ca VI va EN.
 *  - 100% task co snapshot ton tai + `content_hash` khop file snapshot.
 *  - Nhom `general_qa` dung `context_mode: 'none'` (FC-12).
 *  - Nhom `vision` tach duong upload vs duong anh trong DOM (`notes`).
 */

const APP_ROOT = resolve(import.meta.dirname, '..')
const REPO_ROOT = resolve(APP_ROOT, '..', '..')

/** So task toi da theo nhom (EVAL_PLAN.md §3.2). */
const MIN_PER_GROUP: Record<string, number> = {
  page_qa: 12,
  summarize: 10,
  cross_tab: 10,
  writing: 8,
  vision: 4,
  doc_extract: 2,
  video_transcript: 2,
  general_qa: 4,
}

describe('dataset that — cau truc', () => {
  it('co it nhat 52 task', async () => {
    const tasks = await loadDataset()
    expect(tasks.length).toBeGreaterThanOrEqual(52)
  })

  it('validate duoc bang evalTaskListSchema (contract shared)', async () => {
    const raw = JSON.parse(
      await readFile(resolve(APP_ROOT, 'dataset', 'tasks.json'), 'utf8'),
    ) as unknown
    expect(evalTaskListSchema.safeParse(raw).success).toBe(true)
  })

  it('id la duy nhat', async () => {
    const tasks = await loadDataset()
    const ids = tasks.map((task) => task.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('du 8 nhom va dat so task toi dau o tung nhom', async () => {
    const tasks = await loadDataset()
    const counts = new Map<string, number>()
    for (const task of tasks) {
      counts.set(task.group, (counts.get(task.group) ?? 0) + 1)
    }

    expect([...counts.keys()].sort()).toEqual([...EVAL_GROUPS].sort())
    for (const [group, min] of Object.entries(MIN_PER_GROUP)) {
      expect(counts.get(group) ?? 0).toBeGreaterThanOrEqual(min)
    }
  })
})

describe('dataset that — chat luong noi dung', () => {
  it('≥ 80% task co must_include_facts', async () => {
    const tasks = await loadDataset()
    const withFacts = tasks.filter(
      (task) => (task.reference?.must_include_facts?.length ?? 0) > 0,
    )
    expect(withFacts.length / tasks.length).toBeGreaterThanOrEqual(0.8)
  })

  it('≥ 40% task tieng Viet', async () => {
    const tasks = await loadDataset()
    const vi = tasks.filter((task) => task.lang === 'vi')
    expect(vi.length / tasks.length).toBeGreaterThanOrEqual(0.4)
  })

  it('moi nhom deu co ca task tieng Viet va tieng Anh', async () => {
    const tasks = await loadDataset()
    for (const group of EVAL_GROUPS) {
      const inGroup = tasks.filter((task) => task.group === group)
      expect(inGroup.some((task) => task.lang === 'vi')).toBe(true)
      expect(inGroup.some((task) => task.lang === 'en')).toBe(true)
    }
  })

  it('nhom cross_tab co 2–3 trang moi task', async () => {
    const tasks = await loadDataset()
    const crossTab = tasks.filter((task) => task.group === 'cross_tab')
    for (const task of crossTab) {
      const total = 1 + (task.pages?.length ?? 0)
      expect(total).toBeGreaterThanOrEqual(2)
      expect(total).toBeLessThanOrEqual(3)
      expect(task.context_mode).toBe('pages')
    }
  })

  it('nhom general_qa dung context_mode none (FC-12)', async () => {
    const tasks = await loadDataset()
    const general = tasks.filter((task) => task.group === 'general_qa')
    expect(general.length).toBeGreaterThanOrEqual(4)
    for (const task of general) {
      expect(task.context_mode).toBe('none')
    }
  })

  it('nhom vision co duong upload va duong anh trong DOM, co notes ghi ro', async () => {
    const tasks = await loadDataset()
    const vision = tasks.filter((task) => task.group === 'vision')
    expect(vision.length).toBeGreaterThanOrEqual(4)

    // Duong A (upload) → co `assets[]` dinh kem that.
    const upload = vision.filter((task) => (task.assets?.length ?? 0) > 0)
    expect(upload.length).toBeGreaterThanOrEqual(2)

    // Duong B (anh trong DOM) → `notes` phai noi ro "provider limitation".
    const domPath = vision.filter((task) => (task.notes ?? '').includes('dom-image-path'))
    expect(domPath.length).toBeGreaterThanOrEqual(1)
    for (const task of domPath) {
      expect(task.notes ?? '').toContain('provider limitation')
    }
  })

  it('nhom doc_extract va video_transcript co it nhat 1 task tieng Viet', async () => {
    const tasks = await loadDataset()
    for (const group of ['doc_extract', 'video_transcript']) {
      const inGroup = tasks.filter((task) => task.group === group)
      expect(inGroup.length).toBeGreaterThanOrEqual(2)
      expect(inGroup.some((task) => task.lang === 'vi')).toBe(true)
    }
  })

  it('expected_citations: 1 cho task 1 trang, 2–3 cho cross_tab', async () => {
    const tasks = await loadDataset()
    for (const task of tasks) {
      if (task.expected_citations === undefined) continue
      if (task.group === 'cross_tab') {
        expect(task.expected_citations).toBeGreaterThanOrEqual(2)
        expect(task.expected_citations).toBeLessThanOrEqual(3)
      } else if (task.group === 'general_qa' || task.group === 'vision') {
        expect(task.expected_citations).toBe(0)
      } else {
        expect(task.expected_citations).toBe(1)
      }
    }
  })
})

describe('dataset that — snapshot khop hash', () => {
  it('100% task co file snapshot ton tai', async () => {
    const tasks = await loadDataset()

    for (const task of tasks) {
      const paths = [task.page.snapshot_path, ...(task.pages ?? []).map((p) => p.snapshot_path)]
      for (const path of paths) {
        const content = await readFile(resolve(REPO_ROOT, path), 'utf8')
        expect(content.length).toBeGreaterThan(0)
      }
    }
  })

  it('content_hash khop voi file snapshot (tru task khong gui context)', async () => {
    const tasks = await loadDataset()

    for (const task of tasks) {
      if (task.context_mode === 'none') continue

      const pages = [task.page, ...(task.pages ?? [])]
      for (const page of pages) {
        const content = await readFile(resolve(REPO_ROOT, page.snapshot_path), 'utf8')
        expect(sha256Content(content)).toBe(page.content_hash)
      }
    }
  })

  it('asset cua task vision ton tai tren dia chi va dung kich thuoc', async () => {
    const tasks = await loadDataset()
    const withAssets = tasks.filter((task) => (task.assets?.length ?? 0) > 0)

    expect(withAssets.length).toBeGreaterThanOrEqual(4)

    for (const task of withAssets) {
      for (const asset of task.assets ?? []) {
        const buffer = await readFile(resolve(REPO_ROOT, asset.path))
        expect(buffer.byteLength).toBe(asset.bytes)
        expect(buffer.byteLength).toBeGreaterThan(0)
      }
    }
  })
})

describe('dataset that — dataset_meta khop', () => {
  it('moi nguon trong dataset_meta co checksum nhat quan', async () => {
    const meta = JSON.parse(
      await readFile(resolve(APP_ROOT, 'dataset', 'dataset_meta.json'), 'utf8'),
    ) as {
      sources: Array<{
        slug: string
        snapshot_path: string
        content_hash: string
        error?: string
        asset_path?: string
        asset_bytes?: number
      }>
    }

    expect(meta.sources.length).toBeGreaterThanOrEqual(40)

    for (const source of meta.sources) {
      expect(source.error).toBeUndefined()
      if (source.asset_path !== undefined) {
        const buffer = await readFile(resolve(REPO_ROOT, source.asset_path))
        expect(buffer.byteLength).toBe(source.asset_bytes)
        continue
      }
      const content = await readFile(resolve(REPO_ROOT, source.snapshot_path), 'utf8')
      expect(sha256Content(content)).toBe(source.content_hash)
    }
  })
})
