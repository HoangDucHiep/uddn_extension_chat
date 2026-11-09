import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { filterTasks, loadDataset } from '../src/dataset.js'
import { EVAL_GROUPS, type EvalGroup, type EvalTask } from '../src/types.js'

/**
 * Test contract eval dataset (T-M2-12 — nen cho eval harness).
 *
 * Kiem chung:
 *  - Fixture hop le cho **tung** group trong 8 group cua `EVAL_PLAN.md` §3.2.
 *  - Validator **reject** task sai (group sai · field sai kieu · thieu field).
 *  - Loi co **duong dan field** ro rang.
 *  - `filterTasks` loc theo group + lang.
 *
 * Docs: docs/EVAL_PLAN.md §3.1, §3.2
 */

/**
 * Tao 1 task hop le.
 *
 * @param overrides - Cac truong ghi de.
 */
function task(overrides: Partial<EvalTask> = {}): EvalTask {
  return {
    id: 'page-qa-001',
    group: 'page_qa',
    lang: 'vi',
    page: {
      url: 'https://example.com/article',
      title: 'Bai viet mau',
      snapshot_path: 'eval/snapshots/article-2026-11-03.txt',
      content_hash: 'sha256:abc123',
    },
    prompt: 'Tom tat 5 y chinh cua bai nay.',
    reference: {
      key_points: ['Y chinh 1', 'Y chinh 2'],
      must_include_facts: ['87%'],
      must_not_contain: ['khong duoc noi'],
    },
    expected_citations: 3,
    tags: ['news', 'vi'],
    ...overrides,
  }
}

/**
 * Ghi dataset tam va tra duong dan.
 *
 * @param content - Noi dung JSON.
 */
async function writeTempDataset(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'sidekick-eval-'))
  const path = join(dir, 'tasks.json')
  await writeFile(path, content, 'utf8')
  return path
}

describe('eval contract', () => {
  it('EVAL_GROUPS co du 8 group theo EVAL_PLAN §3.2', () => {
    expect([...EVAL_GROUPS]).toEqual([
      'page_qa',
      'summarize',
      'cross_tab',
      'writing',
      'vision',
      'doc_extract',
      'video_transcript',
      'general_qa',
    ])
  })

  it('fixture hop le cho TUNG group', async () => {
    for (const group of EVAL_GROUPS) {
      const path = await writeTempDataset(
        JSON.stringify([task({ id: `${group}-001`, group: group as EvalGroup })]),
      )
      const tasks = await loadDataset(path)
      expect(tasks).toHaveLength(1)
      expect(tasks[0]?.group).toBe(group)
      await rm(path, { force: true })
    }
  })

  it('task hop le giu nguyen field snake_case theo plan', async () => {
    const path = await writeTempDataset(JSON.stringify([task()]))
    const tasks = await loadDataset(path)

    expect(tasks[0]?.page.snapshot_path).toBe('eval/snapshots/article-2026-11-03.txt')
    expect(tasks[0]?.page.content_hash).toBe('sha256:abc123')
    expect(tasks[0]?.reference?.must_include_facts).toEqual(['87%'])
    expect(tasks[0]?.reference?.must_not_contain).toEqual(['khong duoc noi'])
    expect(tasks[0]?.expected_citations).toBe(3)

    await rm(path, { force: true })
  })

  it('reference / expected_citations / tags / notes la optional', async () => {
    const path = await writeTempDataset(
      JSON.stringify([
        {
          id: 'general-qa-001',
          group: 'general_qa',
          lang: 'en',
          page: {
            url: 'https://example.com/',
            title: 'Home',
            snapshot_path: 'eval/snapshots/home.txt',
            content_hash: 'sha256:def456',
          },
          prompt: 'Explain closures in JavaScript.',
        },
      ]),
    )
    const tasks = await loadDataset(path)

    expect(tasks[0]?.reference).toBeUndefined()
    expect(tasks[0]?.expected_citations).toBeUndefined()

    await rm(path, { force: true })
  })

  it('reject group khong hop le', async () => {
    const path = await writeTempDataset(JSON.stringify([task({ group: 'summarization' as never })]))

    await expect(loadDataset(path)).rejects.toThrow(/group/)

    await rm(path, { force: true })
  })

  it('reject field reference sai kieu', async () => {
    const path = await writeTempDataset(
      JSON.stringify([
        task({ reference: { must_include_facts: 'khong phai mang' } as never }),
      ]),
    )

    await expect(loadDataset(path)).rejects.toThrow(/must_include_facts/)

    await rm(path, { force: true })
  })

  it('reject khi thieu page.snapshot_path', async () => {
    const invalid = task()
    delete (invalid.page as Partial<typeof invalid.page>).snapshot_path
    const path = await writeTempDataset(JSON.stringify([invalid]))

    await expect(loadDataset(path)).rejects.toThrow(/snapshot_path/)

    await rm(path, { force: true })
  })

  it('reject khi thieu id', async () => {
    const invalid = task()
    delete (invalid as Partial<EvalTask>).id
    const path = await writeTempDataset(JSON.stringify([invalid]))

    await expect(loadDataset(path)).rejects.toThrow(/id/)

    await rm(path, { force: true })
  })

  it('reject lang khong hop le', async () => {
    const path = await writeTempDataset(JSON.stringify([task({ lang: 'fr' as never })]))

    await expect(loadDataset(path)).rejects.toThrow(/lang/)

    await rm(path, { force: true })
  })

  it('reject dataset khong phai array', async () => {
    const path = await writeTempDataset(JSON.stringify({ tasks: [] }))

    await expect(loadDataset(path)).rejects.toThrow(/JSON array/)

    await rm(path, { force: true })
  })

  it('filterTasks loc theo group + lang', () => {
    const tasks: EvalTask[] = [
      task({ id: 'a', group: 'page_qa', lang: 'vi' }),
      task({ id: 'b', group: 'summarize', lang: 'en' }),
    ]

    expect(filterTasks(tasks, { group: 'page_qa' })).toHaveLength(1)
    expect(filterTasks(tasks, { lang: 'en' })).toHaveLength(1)
    expect(filterTasks(tasks, { group: 'page_qa', lang: 'en' })).toHaveLength(0)
    expect(filterTasks(tasks, {})).toHaveLength(2)
  })
})
