import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { evalTaskSchema, type EvalGroup, type EvalLang, type EvalTask } from './types.js'

/**
 * Loader cho eval dataset.
 *
 * Dataset luu o `apps/eval/dataset/tasks.json` (dang array).
 * File snapshot noi dung trang nam o `apps/eval/dataset/snapshots/`.
 *
 * Validate bang `evalTaskSchema` (Zod) tu `@sidekick/shared` → **1 nguon
 * su that** cho contract dataset (dung chung voi server) + loi co **duong
 * dan field** ro rang.
 *
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

/**
 * Kiem tra 1 task co dung schema khong.
 *
 * @param value - Gia tri raw tu JSON.
 * @param index - Vi tri trong mang (de bao loi ro rang).
 * @returns Task da qua validate.
 * @throws Error neu task khong hop le.
 */
function validateTask(value: unknown, index: number): EvalTask {
  const result = evalTaskSchema.safeParse(value)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ')
    throw new Error(`Task tai index ${index} khong hop le schema — ${issues}`)
  }

  return result.data
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
