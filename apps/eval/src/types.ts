/**
 * Kieu du lieu cua eval dataset.
 *
 * Cau truc khoi tao theo docs/EVAL_PLAN.md §3.1. Phan thu thap du lieu
 * va judge LLM duoc implement o M2 (T-M2-*) — M0 chi khoi tao scaffold
 * de monorepo typecheck/build duoc nhat quan.
 */

/** Nhom task trong dataset. */
export const EVAL_GROUPS = ['page_qa', 'summarization', 'rewrite', 'coding', 'comparison'] as const
export type EvalGroup = (typeof EVAL_GROUPS)[number]

/** Ngon ngu cua task. */
export type EvalLang = 'vi' | 'en'

/** Mot task trong dataset. */
export interface EvalTask {
  /** Id duy nhat, dang `<group>-<nguoi-tao>-<so>`. */
  id: string
  group: EvalGroup
  lang: EvalLang
  /** Mo ta trang web de dung lam context. */
  page: {
    url: string
    title: string
    /** Duong dan snapshot noi dung trang (tuong doi repo root). */
    snapshotPath: string
    /** Hash noi dung de phat hien thay doi snapshot. */
    contentHash: string
  }
  /** Cau hoi dua vao side panel. */
  prompt: string
  /** Cau tra loi chuan (neu co) — dung cho metric tu dong. */
  reference?: {
    answer: string
    keyFacts?: string[]
  }
  /** Ghi chu cho nguoi cham. */
  notes?: string
}

/** Ket qua mot lan chay mot task tren mot he thong. */
export interface EvalRunResult {
  taskId: string
  /** Id he thong: `sidekick` | `edge-copilot` | `chrome-gemini`. */
  system: string
  /** Cau tra loi thu duoc. */
  answer: string
  /** Diem rubric 1-5 do LLM-as-judge cham. */
  rubricScore?: number
  /** Do tre lan dau token (ms) — chi do duoc khi co timestamp server. */
  ttftMs?: number
  /** Tong so token output. */
  tokensOut?: number
  /** Chi phi (USD). */
  costUsd?: number
  /** Loi neu task that bai. */
  error?: string
}

/** Chu ky chay mot task (de tinh trung bin). */
export const EVAL_RUNS_PER_TASK = 3
