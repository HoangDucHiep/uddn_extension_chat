import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { EVAL_GROUPS, type EvalGroup, type EvalTask, type EvalLang } from './types.js'

/**
 * Loader cho eval dataset.
 *
 * Dataset luu o `apps/eval/dataset/tasks.json` (dang array).
 * File snapshot noi dung trang nam o `apps/eval/dataset/snapshots/`.
 * Docs: docs/EVAL_PLAN.md §3
 */

/** Thu muc goc cua app eval. */
const APP_ROOT = resolve(import.meta.dirname, '..')

/** Duong dan file dataset mac dinh. */
export const DEFAULT_DATASET_PATH = resolve(APP_ROOT, 'dataset', 'tasks.json')

/** Load dataset tu file JSON. */
export async function loadDataset(path: string = DEFAULT_DATASET_PATH): Promise<EvalTask[]> {
  const raw = await readFile(path, 'utf8')
  const parsed: unknown = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error('Dataset phai la mot JSON array')
  }

  return parsed.map((task, index) => validateTask(task, index))
}

/** Kiem tra 1 task co dung schema khong. */
function validateTask(value: unknown, index: number): EvalTask {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Task tai index ${index} khong phai object`)
  }

  const task = value as Record<string, unknown>

  if (typeof task['id'] !== 'string' || task['id'].length === 0) {
    throw new Error(`Task tai index ${index} thieu "id"`)
  }

  const group = task['group']
  if (typeof group !== 'string' || !EVAL_GROUPS.includes(group as EvalTask['group'])) {
    throw new Error(`Task ${String(task['id'])} co "group" khong hop le`)
  }

  const lang = task['lang']
  if (lang !== 'vi' && lang !== 'en') {
    throw new Error(`Task ${String(task['id'])} co "lang" khong hop le`)
  }

  const page = task['page']
  if (typeof page !== 'object' || page === null) {
    throw new Error(`Task ${String(task['id'])} thieu "page"`)
  }

  const pageData = page as Record<string, unknown>
  for (const key of ['url', 'title', 'snapshotPath', 'contentHash']) {
    if (typeof pageData[key] !== 'string') {
      throw new Error(`Task ${String(task['id'])} thiếu "page.${key}"`)
    }
  }

  if (typeof task['prompt'] !== 'string' || task['prompt'].length === 0) {
    throw new Error(`Task ${String(task['id'])} thieu "prompt"`)
  }

  return task as unknown as EvalTask
}

/** Loc dataset theo nhom va ngon ngu. */
export function filterTasks(
  tasks: EvalTask[],
  filters: { group?: EvalGroup; lang?: EvalLang },
): EvalTask[] {
  return tasks.filter((task) => {
    if (filters.group !== undefined && task.group !== filters.group) return false
    if (filters.lang !== undefined && task.lang !== filters.lang) return false
    return true
  })
}
