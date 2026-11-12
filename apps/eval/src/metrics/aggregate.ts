/**
 * Tong hop metric cho eval harness (T-M2-13).
 *
 * Tinh theo [`EVAL_PLAN.md`](../../../docs/EVAL_PLAN.md) §5:
 *  - §5.1 Chat luong: `overallScore` · `groundednessRate` ·
 *    `citationPrecision` · `citationRecall` · `hallucinationRate` ·
 *    `taskSuccessRate`.
 *  - §5.2 Hieu nang: `ttftP50` / `ttftP95` · `latencyP50` / `latencyP95` ·
 *    `tokensPerSecond`.
 *  - §5.3 Chi phi: `costUsd` · `costPerTask` · `costPerCorrectTask`.
 *
 * Diem rubric do LLM-as-judge cham (T-M2-14) → file judge duoc doc vao
 * truoc khi tong hop. Lượt **khong** co diem judge → khong tinh vao
 * `overallScore` (khong coi la 0 — tranh "phan biet do model" sai lech).
 *
 * Docs: docs/EVAL_PLAN.md §5
 */

import type { EvalJudgeResult, EvalTask } from '@sidekick/shared'
import type { TaskRun } from '../runners/ours.js'

/**
 * Trong so rubric theo nhom task (`EVAL_PLAN.md` §4.2).
 *
 * Chi luu tieu chi **nang** cho tung nhom → diem tong hop phan anh trong
 * tam nhom do (VD `page_qa` thi R1/R2/R3/R5 quan trong nhat).
 */
export const GROUP_RUBRIC_WEIGHTS: Record<string, readonly string[]> = {
  page_qa: ['R1', 'R2', 'R3', 'R5'],
  summarize: ['R1', 'R3', 'R4'],
  cross_tab: ['R1', 'R2', 'R5'],
  writing: ['R2', 'R4'],
  vision: ['R1', 'R2'],
  doc_extract: ['R1', 'R3'],
  video_transcript: ['R1', 'R3'],
  general_qa: ['R2', 'R4'],
}

/**
 * Trong so **mac dinh** khi nhom khong nam trong bang tren.
 *
 * R1–R5 weight 2 · R7 weight 1 (theo `EVAL_PLAN.md` §4.1 — R6/R8 do
 * con nguoi cham o Tang B).
 */
export const DEFAULT_RUBRIC_WEIGHTS: Record<string, number> = {
  R1: 2,
  R2: 2,
  R3: 2,
  R4: 2,
  R5: 2,
  R7: 1,
}

/** 1 diem judge ghep voi 1 luot chay. */
export interface ScoredRun {
  /** Task run tuong ung. */
  taskId: string
  /** Nhom task. */
  group: string
  /** Ngon ngu task. */
  lang: string
  /** So lan chay. */
  run: number
  /** Diem judge (neu co). */
  judge: EvalJudgeResult | undefined
  /** Luot chay. */
  runResult: TaskRun
}

/** Chi so tong hop 1 nhom (theo he thong / theo nhom / theo ngon ngu). */
export interface MetricSlice {
  /** So luot chay co du lieu. */
  runs: number
  /** So luot chay **co** diem judge. */
  scoredRuns: number
  /** So task duy nhat. */
  tasks: number
  /** Diem tong hop 0–100 (tb co trong so) — `undefined` neu chua co diem. */
  overallScore: number | undefined
  /** Diem trung binh tung tieu chi R1..R7. */
  rubricAverages: Record<string, number>
  /** % claim co trong nguon. */
  groundednessRate: number | undefined
  /** % trich dan tro dung doan nguon. */
  citationPrecision: number | undefined
  /** % trich dan ky vong co mat. */
  citationRecall: number | undefined
  /** % claim khong co trong nguon. */
  hallucinationRate: number | undefined
  /** % task dat >= 4.0 o R1, R2, R3. */
  taskSuccessRate: number | undefined
  /** TTFT p50 (ms). */
  ttftP50: number | undefined
  /** TTFT p95 (ms). */
  ttftP95: number | undefined
  /** Tong latency p50 (ms). */
  latencyP50: number | undefined
  /** Tong latency p95 (ms). */
  latencyP95: number | undefined
  /** Token output / giay. */
  tokensPerSecond: number | undefined
  /** Tong token vao. */
  tokensIn: number
  /** Tong token ra. */
  tokensOut: number
  /** Tong chi phi (USD). */
  costUsd: number
  /** Chi phi trung binh moi task (USD). */
  costPerTask: number | undefined
  /** Chi phi cho moi task dat chuan (USD). */
  costPerCorrectTask: number | undefined
  /** So task loi. */
  errors: number
}

/**
 * Tinh phan vi (percentile) cua 1 day so.
 *
 * Dung **nearest-rank** (khong noi suy) → ket qua luon la mot gia tri co
 * that trong dataset (de doc va doi chieu duoc).
 *
 * @param values - Day so (khong sap xep).
 * @param p - Phan vi 0–1 (VD `0.95` cho p95).
 */
export function percentile(values: readonly number[], p: number): number | undefined {
  if (values.length === 0) return undefined

  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(p * sorted.length)
  const index = Math.min(Math.max(rank, 1), sorted.length) - 1

  return sorted[index]
}

/**
 * Tinh diem tong hop 0–100 tu diem rubric.
 *
 * Cong thuc: trong so theo nhom (`GROUP_RUBRIC_WEIGHTS`) → moi tieu chi
 * gia tri 1–5 → quy doi thang 0–100 bang `(diem - 1) / 4 * 100`.
 *
 * @param judge - Diem judge.
 * @param group - Nhom task.
 */
export function computeOverallScore(judge: EvalJudgeResult, group: string): number {
  const weights = GROUP_RUBRIC_WEIGHTS[group]
  const entries = Object.entries(judge.scores) as Array<[string, number]>

  let weightedSum = 0
  let weightTotal = 0

  for (const [criterion, value] of entries) {
    const weight = weights?.includes(criterion) === true ? 2 : (DEFAULT_RUBRIC_WEIGHTS[criterion] ?? 1)
    weightedSum += ((value - 1) / 4) * 100 * weight
    weightTotal += weight
  }

  if (weightTotal === 0) return 0
  return Math.round((weightedSum / weightTotal) * 10) / 10
}

/**
 * Kiem tra 1 luot chay co "dat chuan" khong (R1, R2, R3 deu >= 4.0).
 *
 * @param judge - Diem judge.
 */
export function isCorrectTask(judge: EvalJudgeResult | undefined): boolean {
  if (judge === undefined) return false
  return judge.scores.R1 >= 4 && judge.scores.R2 >= 4 && judge.scores.R3 >= 4
}

/**
 * Tinh 1 chi so tong hop tu danh sach luot chay.
 *
 * @param runs - Danh sach luot chay (da gom diem judge).
 * @param tasks - Task tuong ung (de biet `expected_citations`).
 */
export function aggregateRuns(
  runs: readonly ScoredRun[],
  tasks: readonly EvalTask[] = [],
): MetricSlice {
  const taskMap = new Map(tasks.map((task) => [task.id, task]))
  const scored = runs.filter((item) => item.judge !== undefined)
  const errors = runs.filter((item) => item.runResult.status === 'error').length
  const taskIds = new Set(runs.map((item) => item.taskId))

  const slice: MetricSlice = {
    runs: runs.length,
    scoredRuns: scored.length,
    tasks: taskIds.size,
    rubricAverages: {},
    overallScore: undefined,
    groundednessRate: undefined,
    citationPrecision: undefined,
    citationRecall: undefined,
    hallucinationRate: undefined,
    taskSuccessRate: undefined,
    ttftP50: undefined,
    ttftP95: undefined,
    latencyP50: undefined,
    latencyP95: undefined,
    tokensPerSecond: undefined,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    costPerTask: undefined,
    costPerCorrectTask: undefined,
    errors,
  }

  // --- Diem rubric ---
  if (scored.length > 0) {
    const first = scored[0]?.judge
    const criteria = first !== undefined ? (Object.keys(first.scores) as Array<keyof EvalJudgeResult['scores']>) : []

    for (const criterion of criteria) {
      const values = scored
        .map((item) => item.judge?.scores[criterion])
        .filter((value): value is number => value !== undefined)

      if (values.length > 0) {
        slice.rubricAverages[criterion] =
          Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
      }
    }

    const overall = scored
      .map((item) => {
        const judge = item.judge
        return judge === undefined ? undefined : computeOverallScore(judge, item.group)
      })
      .filter((value): value is number => value !== undefined)
    slice.overallScore =
      overall.length > 0
        ? Math.round((overall.reduce((sum, value) => sum + value, 0) / overall.length) * 10) / 10
        : undefined
  }

  // --- Groundedness / hallucination (tu judge) ---
  //
  // Chi tinh tren task **co** tai lieu (ground truth).
  //
  // Task `context_mode: 'none'` (nhom `general_qa`) khong co nguon de doi
  // chieu → `hallucinated_claims` khong co y nghia → dua vao cong thuc se
  // lam `hallucinationRate` = 100% (sai) va keo `groundednessRate` xuong.
  //
  // → loai khoi cong thuc, metric cho nhom do = `undefined` (n/a) — **khong**
  // coi la 0 (khong gia loi "do model").
  const scorable = scored.filter((item) => taskMap.get(item.taskId)?.context_mode !== 'none')

  if (scorable.length > 0) {
    const cited = scorable.reduce((sum, item) => sum + (item.judge?.citation_check.cited ?? 0), 0)
    const verified = scorable.reduce((sum, item) => sum + (item.judge?.citation_check.verified ?? 0), 0)
    const missing = scorable.reduce((sum, item) => sum + (item.judge?.missing_key_points.length ?? 0), 0)
    const hallucinated = scorable.reduce(
      (sum, item) => sum + (item.judge?.hallucinated_claims.length ?? 0),
      0,
    )

    const totalClaims = cited + missing + hallucinated
    slice.citationPrecision = cited > 0 ? Math.round((verified / cited) * 1000) / 10 : undefined
    slice.groundednessRate =
      totalClaims > 0 ? Math.round(((cited - hallucinated) / totalClaims) * 1000) / 10 : undefined
    slice.hallucinationRate =
      totalClaims > 0 ? Math.round((hallucinated / totalClaims) * 1000) / 10 : undefined
  }

  // --- Citation recall (so trich dan thuc te / expected_citations) ---
  const recallHits: number[] = []
  const recallTotal: number[] = []
  for (const item of runs) {
    const expected = taskMap.get(item.taskId)?.expected_citations
    if (expected === undefined || expected <= 0) continue
    const actual = item.runResult.citations.length
    recallHits.push(Math.min(actual, expected))
    recallTotal.push(expected)
  }
  if (recallTotal.length > 0) {
    const hit = recallHits.reduce((total, value) => total + value, 0)
    const total = recallTotal.reduce((acc, value) => acc + value, 0)
    slice.citationRecall = total > 0 ? Math.round((hit / total) * 1000) / 10 : undefined
  }

  // --- Task success rate (>= 4.0 o R1, R2, R3) ---
  if (scored.length > 0) {
    const successes = scored.filter((item) => isCorrectTask(item.judge)).length
    slice.taskSuccessRate = Math.round((successes / scored.length) * 1000) / 10
  }

  // --- Hieu nang ---
  const ttfts = runs
    .map((item) => item.runResult.ttftMs)
    .filter((value): value is number => value !== undefined)
  const latencies = runs
    .map((item) => item.runResult.latencyMs)
    .filter((value): value is number => value !== undefined)

  slice.ttftP50 = percentile(ttfts, 0.5)
  slice.ttftP95 = percentile(ttfts, 0.95)
  slice.latencyP50 = percentile(latencies, 0.5)
  slice.latencyP95 = percentile(latencies, 0.95)

  const streamRates = runs
    .map((item) => {
      const tokensOut = item.runResult.tokensOut
      const latencyMs = item.runResult.latencyMs ?? 0
      if (tokensOut === undefined || latencyMs <= 0) return undefined
      return tokensOut / (latencyMs / 1000)
    })
    .filter((value): value is number => value !== undefined)
  if (streamRates.length > 0) {
    slice.tokensPerSecond =
      Math.round((streamRates.reduce((sum, value) => sum + value, 0) / streamRates.length) * 10) / 10
  }

  // --- Chi phi ---
  const tokensIn = runs.reduce((sum, item) => sum + (item.runResult.tokensIn ?? 0), 0)
  const tokensOut = runs.reduce((sum, item) => sum + (item.runResult.tokensOut ?? 0), 0)
  const cost = runs.reduce((sum, item) => sum + (item.runResult.costUsd ?? 0), 0)

  slice.tokensIn = tokensIn
  slice.tokensOut = tokensOut
  slice.costUsd = Math.round(cost * 1e6) / 1e6

  if (taskIds.size > 0) {
    slice.costPerTask = Math.round((cost / taskIds.size) * 1e6) / 1e6
  }

  const correctTasks = new Set(
    scored.filter((item) => isCorrectTask(item.judge)).map((item) => item.taskId),
  )
  if (correctTasks.size > 0) {
    slice.costPerCorrectTask = Math.round((cost / correctTasks.size) * 1e6) / 1e6
  }

  return slice
}

/**
 * Tong hop day du: tong + theo nhom + theo ngon ngu + theo provider.
 *
 * Tach theo **provider** de phan biet *model capability* voi *assistant
 * system* (ke hoach T-M2-13 §3) — khi server fallback sang provider du phong
 * (FR-PROVIDER-04) thi cau tra loi do provider nao sinh ra, khong phai
 * provider dau tien trong chuoi fallback.
 *
 * @param runs - Danh sach luot chay (da gom diem judge).
 * @param tasks - Task tuong ung.
 */
export function aggregateAll(
  runs: readonly ScoredRun[],
  tasks: readonly EvalTask[] = [],
): {
  overall: MetricSlice
  byGroup: Record<string, MetricSlice>
  byLang: Record<string, MetricSlice>
  byProvider: Record<string, MetricSlice>
} {
  const overall = aggregateRuns(runs, tasks)

  const groupMap = new Map<string, ScoredRun[]>()
  const langMap = new Map<string, ScoredRun[]>()
  const providerMap = new Map<string, ScoredRun[]>()

  for (const run of runs) {
    const groupRuns = groupMap.get(run.group) ?? []
    groupRuns.push(run)
    groupMap.set(run.group, groupRuns)

    const langRuns = langMap.get(run.lang) ?? []
    langRuns.push(run)
    langMap.set(run.lang, langRuns)

    // Provider that su = provider cuoi cung trong fallback chain (da ghi
    // sau event `provider_switch`) → dung provider do.
    const provider = run.runResult.provider ?? 'unknown'
    const providerRuns = providerMap.get(provider) ?? []
    providerRuns.push(run)
    providerMap.set(provider, providerRuns)
  }

  const byGroup: Record<string, MetricSlice> = {}
  for (const [group, groupRuns] of groupMap) {
    byGroup[group] = aggregateRuns(groupRuns, tasks)
  }

  const byLang: Record<string, MetricSlice> = {}
  for (const [lang, langRuns] of langMap) {
    byLang[lang] = aggregateRuns(langRuns, tasks)
  }

  const byProvider: Record<string, MetricSlice> = {}
  for (const [provider, providerRuns] of providerMap) {
    byProvider[provider] = aggregateRuns(providerRuns, tasks)
  }

  return { overall, byGroup, byLang, byProvider }
}

/**
 * Render 1 chi so tong hop thanh dong Markdown.
 *
 * @param label - Nhan cot dau.
 * @param slice - Chi so tong hop.
 */
export function renderSliceRow(label: string, slice: MetricSlice): string {
  const num = (value: number | undefined, digits = 1): string =>
    value === undefined ? 'n/a' : value.toFixed(digits)

  return `| ${label} | ${num(slice.overallScore)} | ${num(slice.taskSuccessRate)} | ${num(
    slice.hallucinationRate,
  )} | ${num(slice.citationRecall)} | ${num(slice.ttftP50, 0)} | ${num(slice.latencyP50, 0)} | $${num(
    slice.costPerTask,
    4,
  )} |`
}

/**
 * Render bang Markdown tong hop.
 *
 * @param slices - Cac slice can render.
 * @param title - Tieu de bang.
 */
export function renderMarkdownTable(
  slices: Array<{ label: string; slice: MetricSlice }>,
  title: string,
): string {
  const header = `| Nhom | Overall (0-100) | Task success (%) | Hallucination (%) | Citation recall (%) | TTFT p50 (ms) | Latency p50 (ms) | Cost/task (USD) |
|---|---|---|---|---|---|---|---|`

  const rows = slices.map(({ label, slice }) => renderSliceRow(label, slice))

  return [`### ${title}`, '', header, ...rows].join('\n')
}
