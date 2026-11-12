/**
 * Runner eval cho **he thong cua nhom** (T-M2-13).
 *
 * Voi moi task × moi lan chay:
 *  1. Dung context tu **snapshot** (khong doc trang live → FC-2).
 *  2. Goi `POST /api/chat` cua BFF va do TTFT / latency / token / cost.
 *  3. Ghi transcript day du vao `apps/eval/results/ours/<run_id>/`.
 *
 * Nguyen tac:
 *  - `context_mode: 'none'` → **khong** gui payload `context` → do duong
 *    "chat thuan LLM" (FC-12 trong `EVAL_PLAN.md` §9).
 *  - Loi → ghi `status: 'error'` + error code, **khong** retry vo han.
 *  - Retry toi da 2 lan cho loi mang/5xx (khong retry 401/403/429).
 *
 * Docs: docs/EVAL_PLAN.md §6.1
 */

import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  hashContextItems,
  LIMITS,
  type ContextItem,
  type EvalPage,
  type EvalTask,
  type ImageAttachment,
} from '@sidekick/shared'
import { loadSnapshotWithHash } from '../snapshot.js'
import {
  EvalChatError,
  streamChat,
  type ChatStreamRequestMessage,
  type ChatStreamResult,
} from '../sse.js'

/** Thu muc goc cua repo (de duong dan tuong doi nhat quan). */
const APP_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

/**
 * Thu muc goc cua **monorepo** — goc dung cho duong dan tuong doi repo.
 *
 * `asset.path` trong dataset la duong dan tuong doi **repo root** (VD
 * `apps/eval/dataset/assets/python-logo.png`) → resolve tu day.
 */
export const REPO_ROOT = APP_ROOT

/** Thu muc chua ket qua (git-ignore). */
export const RESULTS_DIR = 'apps/eval/results'

/** So lan retry toi da cho loi mang / 5xx. */
const MAX_RETRIES = 2

/** Thoi gian cho giua 2 lan retry (ms). */
const RETRY_BACKOFF_MS = 1_500

/** 1 lan chay cua 1 task. */
export interface TaskRun {
  taskId: string
  /** So lan chay (1..N). */
  run: number
  /** Trang thai: `ok` | `error`. */
  status: 'ok' | 'error'
  /** Cau tra loi cua he thong. */
  answer: string
  /** TTFT do o client (ms). */
  ttftMs?: number
  /** Tong thoi gian stream (ms). */
  latencyMs?: number
  /** Token vao/ra. */
  tokensIn?: number
  tokensOut?: number
  /** Chi phi USD. */
  costUsd?: number
  /** Provider / model thuc te. */
  provider?: string
  model?: string
  /**
   * Chuoi provider da thu (theo thu tu) — rong neu khong co fallback.
   *
   * Ghi tu event SSE `provider_switch` (FR-PROVIDER-04) → biet provider nao
   * that su tra loi (khong phai provider dau tien trong fallback chain).
   */
  fallbackChain?: string[]
  /** Request-id server (de doi chieu voi `request_logs`). */
  requestId?: string
  /** Nguon trich dan (tu SSE `citation`). */
  citations: Array<{ index: number; url: string; title: string; snippet: string }>
  /** Hash snapshot gui di (khoa tai lap luot chay). */
  contextHash?: string
  /** Error code (neu that bai). */
  errorCode?: string
  errorMessage?: string
  /** Thoi gian bat dau luot chay (ISO 8601). */
  startedAt: string
  /** Thoi gian ket thuc luot chay (ISO 8601). */
  finishedAt: string
}

/** Ket qua chay 1 task (gom nhieu lan chay). */
export interface TaskResult {
  task: EvalTask
  runs: TaskRun[]
}

/** Tuy chon chay eval. */
export interface RunOptions {
  /** Base URL cua BFF. */
  baseUrl: string
  /** Provider dung (mac dinh `gemini`). */
  provider?: string
  /** Model dung (mac dinh `gemini-2.5-flash`). */
  model?: string
  /** So lan chay moi task. */
  runs: number
  /** Id cua run (dung de ten thu muc). */
  runId: string
  /** Chi chay nhung task nay (loc theo id). */
  taskIds?: readonly string[] | undefined
  /** Gioi han so task (dung de chay thu). */
  limit?: number | undefined
  /** Chi in ke hoach, khong goi BFF. */
  dryRun?: boolean
  /** Cho nghi giua 2 luot chay (ms) — tranh vuot RPM cua provider free tier. */
  delayMs?: number | undefined
  /**
   * Chi chay nhung **luot chay da loi** cua run truoc (khi `merge`).
   *
   * Luot da **thanh cong** → giu nguyen, khong goi lai provider → tiet kiem
   * quota (Gemini free tier + Groq TPM deu rat han).
   */
  retryFailedOnly?: boolean
  /**
   * Chay lai **tat ca** luot chay (ke ca luot da thành công).
   *
   * Dùng khi **chính harness** bị lỗi (VD ảnh không được đính kèm) →
   * lượt cũ "thành công" nhưng nội dung sai → phải chạy lại từ đầu.
   *
   * Mặc định `false` → cùng `retryFailedOnly` (tiết kiem quota).
   */
  force?: boolean
  /** Ket qua run truoc (dung khi `retryFailedOnly`). */
  existing?: readonly TaskResult[] | undefined
  /** Signal huy. */
  signal?: AbortSignal | undefined
}

/**
 * Doc snapshot cua 1 trang → noi dung text.
 *
 * @param page - Trang can doc.
 */
async function readPageContent(page: EvalPage): Promise<string> {
  if (page.snapshot_path.length === 0) return ''

  try {
    const { content } = await loadSnapshotWithHash(page.snapshot_path)
    return content
  } catch {
    // Snapshot khong doc duoc → context rong (khong nem loi de luot chat van chay).
    return ''
  }
}

/**
 * Dung context cho task tu snapshot.
 *
 * - `context_mode: 'none'` → `undefined` (khong gui context).
 * - `context_mode: 'pages'` → gom `page` + `pages[]`.
 * - Mac dinh (`'page'`) → chi `page`.
 *
 * @param task - Task can dung context.
 * @returns Bundle context, hoac `undefined` khi khong gui context.
 */
export async function buildTaskContext(
  task: EvalTask,
): Promise<{ items: ContextItem[] } | undefined> {
  const mode = task.context_mode ?? 'page'
  if (mode === 'none') return undefined

  const pages = mode === 'pages' ? [task.page, ...(task.pages ?? [])] : [task.page]
  const items: ContextItem[] = []

  for (const [index, page] of pages.entries()) {
    const text = await readPageContent(page)
    if (text.length === 0) continue

    items.push({
      id: `eval-context-${index + 1}`,
      kind: 'tab',
      tier: 'currentTab',
      url: page.url,
      title: page.title,
      text: text.slice(0, LIMITS.MAX_PAGE_TEXT_CHARS),
      sourceKind: sourceKindFor(task.group),
    })
  }

  if (items.length === 0) return undefined
  return { items }
}

/**
 * Loai nguon context cho 1 nhom task.
 *
 * - `doc_extract` → `'pdf'` (text da trich tu file PDF — FR-CONTEXT-05).
 * - `video_transcript` → `'youtube'` (transcript video — FR-CONTEXT-06).
 * - Con lai → `'html'`.
 *
 * @param group - Nhom task.
 */
function sourceKindFor(group: string): 'html' | 'pdf' | 'youtube' {
  if (group === 'doc_extract') return 'pdf'
  if (group === 'video_transcript') return 'youtube'
  return 'html'
}

/**
 * Doc asset (anh) cua task → dinh kem inline base64 (FR-VISION-01).
 *
 * Nhom `vision` dinh kem `assets[].path` → server chuyen tiep cho provider
 * (`inline_data` cua Gemini · `image_url` cua OpenAI-compatible).
 *
 * `asset.path` là đường dẫn **tương đối repo root** (VD
 * `apps/eval/dataset/assets/python-logo.png`) → resolve từ `REPO_ROOT`.
 *
 * @param task - Task can dung.
 * @returns Danh sach anh dinh kem (rong neu task khong co asset).
 */
export async function buildTaskAttachments(task: EvalTask): Promise<ImageAttachment[]> {
  const assets = task.assets ?? []
  const attachments: ImageAttachment[] = []

  for (const asset of assets) {
    if (asset.kind !== 'image') continue

    const absolute = resolve(REPO_ROOT, asset.path)
    let buffer: Buffer
    try {
      buffer = await readFile(absolute)
    } catch {
      // Asset khong doc duoc → bo qua (khong nem loi de luot chat van chay).
      continue
    }

    attachments.push({
      id: randomUUID(),
      mimeType: asset.mime_type as ImageAttachment['mimeType'],
      data: buffer.toString('base64'),
      bytes: buffer.byteLength,
      fileName: asset.path.split('/').pop(),
    })
  }

  return attachments
}

/**
 * Tinh hash context (khoa tai lap luot chay).
 *
 * Dung **cung** ham voi server (`hashContextItems` trong `packages/shared`)
 * → doi chieu duoc voi `request_logs.context_hash`.
 *
 * @param items - Context items gui di.
 */
function computeContextHash(items: readonly ContextItem[]): string {
  return hashContextItems(items)
}

/**
 * Chay 1 task 1 lan.
 *
 * @param task - Task can chay.
 * @param run - So lan chay.
 * @param options - Tuy chon chay.
 */
async function runOnce(
  task: EvalTask,
  run: number,
  options: RunOptions,
): Promise<TaskRun> {
  const startedAt = new Date().toISOString()
  const context = await buildTaskContext(task)
  const attachments = await buildTaskAttachments(task)
  const requestId = `eval-${task.id}-r${run}-${randomUUID().slice(0, 8)}`

  const base: TaskRun = {
    taskId: task.id,
    run,
    status: 'error',
    answer: '',
    latencyMs: 0,
    citations: [],
    startedAt,
    finishedAt: startedAt,
    ...(context !== undefined ? { contextHash: computeContextHash(context.items) } : {}),
  }

  if (options.dryRun === true) {
    return {
      ...base,
      status: 'ok',
      finishedAt: new Date().toISOString(),
      answer: '(dry-run — không gọi BFF)',
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const message: ChatStreamRequestMessage = {
        role: 'user',
        content: task.prompt,
        ...(attachments.length > 0 ? { attachments } : {}),
      }

      const result = await streamChat(
        options.baseUrl,
        {
          messages: [message],
          ...(options.provider !== undefined ? { provider: options.provider } : {}),
          ...(options.model !== undefined ? { model: options.model } : {}),
          ...(context !== undefined ? { context } : {}),
        },
        { requestId, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
      )

      return toTaskRun(base, result)
    } catch (error) {
      lastError = error

      // 401/403 (sai key) · 429 (rate limit) → retry vo ich → dung ngay.
      if (error instanceof EvalChatError && (error.status === 401 || error.status === 403 || error.status === 429)) {
        break
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BACKOFF_MS)
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError)
  return {
    ...base,
    status: 'error',
    errorCode: lastError instanceof EvalChatError ? `HTTP_${lastError.status}` : 'EVAL_CLIENT_ERROR',
    errorMessage: message,
    finishedAt: new Date().toISOString(),
  }
}

/**
 * Chuyen ket qua stream → TaskRun.
 *
 * @param base - TaskRun nen.
 * @param result - Ket qua stream.
 */
function toTaskRun(base: TaskRun, result: ChatStreamResult): TaskRun {
  const failed = result.errorCode !== undefined

  return {
    ...base,
    status: failed ? 'error' : 'ok',
    answer: result.answer,
    latencyMs: result.latencyMs,
    citations: result.citations,
    finishedAt: new Date().toISOString(),
    ...(result.ttftMs !== undefined ? { ttftMs: result.ttftMs } : {}),
    ...(result.tokensIn !== undefined ? { tokensIn: result.tokensIn } : {}),
    ...(result.tokensOut !== undefined ? { tokensOut: result.tokensOut } : {}),
    ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
    ...(result.provider !== undefined ? { provider: result.provider } : {}),
    ...(result.model !== undefined ? { model: result.model } : {}),
    ...(result.fallbackChain.length > 0 ? { fallbackChain: result.fallbackChain } : {}),
    ...(result.requestId !== undefined ? { requestId: result.requestId } : {}),
    ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
    ...(result.errorMessage !== undefined ? { errorMessage: result.errorMessage } : {}),
  }
}

/**
 * Cho mot khoang thoi gian (ms).
 *
 * @param ms - So mili-giay cho.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Chay **toan bo** task × so lan chay.
 *
 * @param tasks - Danh sach task.
 * @param options - Tuy chon chay.
 * @returns Ket qua theo task + tong hop tat ca luot chay.
 */
export async function runEval(
  tasks: readonly EvalTask[],
  options: RunOptions,
): Promise<{ results: TaskResult[]; runs: TaskRun[] }> {
  const selected = selectTasks(tasks, options)
  const results: TaskResult[] = []
  const allRuns: TaskRun[] = []

  // Luot chay da **thanh cong** cua run truoc → bo qua (tiet kiem quota).
  // `force` → bo qua luong nay → chay lai tat ca.
  const succeeded = new Map<string, Set<number>>()
  if (options.retryFailedOnly === true && options.force !== true) {
    for (const result of options.existing ?? []) {
      const set = new Set<number>()
      for (const run of result.runs) {
        if (run.status === 'ok') set.add(run.run)
      }
      succeeded.set(result.task.id, set)
    }
  }

  for (const task of selected) {
    const runs: TaskRun[] = []
    const done = succeeded.get(task.id) ?? new Set<number>()

    for (let run = 1; run <= options.runs; run += 1) {
      if (done.has(run)) continue

      const taskRun = await runOnce(task, run, options)
      runs.push(taskRun)
      allRuns.push(taskRun)

      // Cho provider "nghỉ" giữa 2 lượt → tránh vượt RPM của free tier
      // (Gemini 429 "quota exceeded" khi bắn liên tiếp).
      if (options.delayMs !== undefined && options.delayMs > 0) {
        await sleep(options.delayMs)
      }
    }

    results.push({ task, runs })
  }

  return { results, runs: allRuns }
}

/**
 * Loc task theo `taskIds` + `limit`.
 *
 * @param tasks - Danh sach task goc.
 * @param options - Tuy chon chay.
 */
export function selectTasks(
  tasks: readonly EvalTask[],
  options: Pick<RunOptions, 'taskIds' | 'limit'>,
): EvalTask[] {
  let selected = [...tasks]

  if (options.taskIds !== undefined && options.taskIds.length > 0) {
    const wanted = new Set(options.taskIds)
    selected = selected.filter((task) => wanted.has(task.id))
  }

  if (options.limit !== undefined && options.limit > 0) {
    selected = selected.slice(0, options.limit)
  }

  return selected
}

/**
 * Ghi ket qua chay vao `apps/eval/results/ours/<run_id>/`.
 *
 * Khi `merge` = `true` → **gộp** voi ket qua da co:
 *  - Luot moi **thanh cong** → ghi de luot cu cung `run` (cu) → sua loi provider.
 *  - Luot moi **that bai** → **giu** luot cu (da thanh cong) → khong lam hong ket qua tot.
 *
 * @param runId - Id cua run.
 * @param results - Ket qua theo task.
 * @param merge - Ghep voi ket qua cu (thay the) hay ghi de.
 */
export async function writeRunResults(
  runId: string,
  results: readonly TaskResult[],
  merge = false,
): Promise<string> {
  const dir = resolve(APP_ROOT, RESULTS_DIR, 'ours', runId)
  await mkdir(dir, { recursive: true })

  for (const result of results) {
    const path = resolve(dir, `${result.task.id}.json`)
    let runs = result.runs

    if (merge) {
      const existing = await readTaskResult(path)
      if (existing !== undefined) {
        runs = mergeTaskRuns(existing.runs, result.runs)
      }
    }

    await writeFile(path, `${JSON.stringify({ task: result.task, runs }, null, 2)}\n`, 'utf8')
  }

  return dir
}

/**
 * Doc 1 file ket qua task (tra `undefined` neu khong ton tai / khong parse duoc).
 *
 * @param path - Duong dan file.
 */
async function readTaskResult(path: string): Promise<TaskResult | undefined> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as TaskResult
  } catch {
    return undefined
  }
}

/**
 * Gop 2 danh sach luot chay cua cung 1 task.
 *
 * Quy tac: **luot moi thanh cong** thay the luot cu cung so; **luot moi that bai**
 * giu nguyen luot cu (da co ket qua tot).
 *
 * @param existing - Luot chay da co.
 * @param incoming - Luot chay moi.
 */
export function mergeTaskRuns(
  existing: readonly TaskRun[],
  incoming: readonly TaskRun[],
): TaskRun[] {
  const byRun = new Map(existing.map((run) => [run.run, run]))

  for (const run of incoming) {
    const current = byRun.get(run.run)
    if (current === undefined || run.status === 'ok') {
      byRun.set(run.run, run)
    }
  }

  return [...byRun.values()].sort((a, b) => a.run - b.run)
}

/**
 * Doc ket qua 1 run tu dia chi.
 *
 * @param runId - Id cua run.
 */
export async function readRunResults(runId: string): Promise<TaskResult[]> {
  const dir = resolve(APP_ROOT, RESULTS_DIR, 'ours', runId)
  const { readdir } = await import('node:fs/promises')

  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const results: TaskResult[] = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const raw = await readFile(resolve(dir, file), 'utf8')
    results.push(JSON.parse(raw) as TaskResult)
  }

  return results
}

/**
 * Ghi file JSON (dung chung cho judge + report).
 *
 * @param relativePath - Duong dan tuong doi repo root.
 * @param payload - Noi dung can ghi.
 */
export async function writeJsonFile(relativePath: string, payload: unknown): Promise<void> {
  const absolute = resolve(APP_ROOT, relativePath)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

/**
 * Doc file JSON.
 *
 * @param relativePath - Duong dan tuong doi repo root.
 */
export async function readJsonFile<T>(relativePath: string): Promise<T | undefined> {
  try {
    const raw = await readFile(resolve(APP_ROOT, relativePath), 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}
