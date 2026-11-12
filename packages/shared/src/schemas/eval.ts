/**
 * Zod schema cho **eval dataset** — nguon su that cho contract dataset.
 *
 * Contract nay **phai khop** voi [`EVAL_PLAN.md`](../../docs/EVAL_PLAN.md)
 * §3.1 (shape 1 task) + §3.2 (8 nhom task).
 *
 * Tu T-M2-12, contract mo rong them:
 *  - `pages[]` — nhom `cross_tab` (so sanh 2–3 tab).
 *  - `assets[]` — nhom `vision` (anh) + `doc_extract` (file PDF).
 *  - `context_mode` — `'none'` cho nhom `general_qa` (chat thuan LLM, FC-12).
 *  - `evalJudgeResultSchema` — output cua LLM-as-judge (T-M2-14).
 *
 * Moi truong bo sung deu **optional** → dataset M1 (chi `page`) van hop le.
 *
 * Vi sao dat o `packages/shared`?
 *  - `apps/eval` dung de validate dataset.
 *  - `apps/server` (tuong lai) co the phuc vu dataset / nhan dataset tu
 *    client → dung **chung 1 nguon su that**, khong viet 2 ban.
 *
 * Docs: docs/EVAL_PLAN.md §3.1, §3.2
 */

import { z } from 'zod'

/**
 * 8 nhom task eval — theo `EVAL_PLAN.md` §3.2.
 *
 * Nhom `workflow` **khong** nam trong day: no thuoc M4 (`EVAL_PLAN.md`
 * §3.2.1) va chi chay khi da implement workflow → them sau, khong lam
 * dataset M2 khong the chay bi reject.
 */
export const EVAL_GROUPS = [
  'page_qa',
  'summarize',
  'cross_tab',
  'writing',
  'vision',
  'doc_extract',
  'video_transcript',
  'general_qa',
] as const

/** Nhom task eval. */
export const evalGroupSchema = z.enum(EVAL_GROUPS)
export type EvalGroup = z.infer<typeof evalGroupSchema>

/** Ngon ngu cua task (theo `EVAL_PLAN.md` §3.2 — ≥ 40% tieng Viet). */
export const evalLangSchema = z.enum(['vi', 'en'])
export type EvalLang = z.infer<typeof evalLangSchema>

/**
 * Trang web dung lam context cho task.
 *
 * `snapshot_path` tro toi file snapshot trong `apps/eval/dataset/snapshots/`
 * → dung lai nguyen tac "tai lap duoc" (`EVAL_PLAN.md` §3.4).
 */
export const evalPageSchema = z.object({
  /** URL day du cua trang. */
  url: z.string().url(),
  /** Tieu de trang. */
  title: z.string(),
  /** Duong dan snapshot noi dung trang (tuong doi repo root). */
  snapshot_path: z.string().min(1),
  /** Hash noi dung — phat hien thay doi snapshot. */
  content_hash: z.string().min(1),
})
export type EvalPage = z.infer<typeof evalPageSchema>

/**
 * Cau tra loi tham chieu — dung cho metric tu dong + LLM-as-judge.
 *
 * `EVAL_PLAN.md` §3.3: **moi task phai co mot dap an tham chieu** de judge
 * cham duoc dinh luong, khong chi dua vao cam nhan.
 */
export const evalReferenceSchema = z.object({
  /** Cac diem chinh can co trong cau tra loi. */
  key_points: z.array(z.string().min(1)).optional(),
  /** Facts bat buoc phai xuat hien (VD con so `87%`). */
  must_include_facts: z.array(z.string().min(1)).optional(),
  /** Cau tra loi **khong** duoc chua (canh bao sai lech). */
  must_not_contain: z.array(z.string().min(1)).optional(),
})
export type EvalReference = z.infer<typeof evalReferenceSchema>

/**
 * Loai asset dinh kem cho task.
 *
 * - `image` → anh (nhom `vision`) — file trong `apps/eval/dataset/assets/`.
 * - `pdf` → file PDF (nhom `doc_extract`) — file trong `apps/eval/dataset/assets/`.
 *
 * Anh/anh PDF **khong** nhet thang vao `tasks.json` (base64 lam file JSON
 * khong doc duoc) → chi luu duong dan + metadata; harness doc file khi chay.
 */
export const EVAL_ASSET_KINDS = ['image', 'pdf'] as const
export type EvalAssetKind = (typeof EVAL_ASSET_KINDS)[number]

/** Asset dinh kem cho 1 task eval. */
export const evalAssetSchema = z.object({
  /** Loai asset. */
  kind: z.enum(EVAL_ASSET_KINDS),
  /** Duong dan file asset, tuong doi repo root. */
  path: z.string().min(1),
  /** MIME type cua file (`image/png` · `application/pdf`). */
  mime_type: z.string().min(1),
  /** Kich thuoc file goc (byte). */
  bytes: z.number().int().nonnegative(),
  /** Mo ta ngan asset — giup nguoi cham hieu dang hoi gi. */
  description: z.string().optional(),
})
export type EvalAsset = z.infer<typeof evalAssetSchema>

/**
 * Che do gui context cua 1 task.
 *
 * - `none` → **khong** gui context → do duong "chat thuan LLM" (FR-CONTEXT-13,
 *   FC-12 trong `EVAL_PLAN.md` §9). Nhom `general_qa` dung che do nay.
 * - `page` → gui snapshot cua `page` (1 nguon).
 * - `pages` → gui snapshot cua `page` + `pages` (nhom `cross_tab`).
 *
 * `undefined` → coi nhu `'page'` (giu tuong thich voi dataset M1).
 */
export const EVAL_CONTEXT_MODES = ['none', 'page', 'pages'] as const
export type EvalContextMode = (typeof EVAL_CONTEXT_MODES)[number]

export const evalContextModeSchema = z.enum(EVAL_CONTEXT_MODES)

/**
 * Schema cua 1 task eval — theo `EVAL_PLAN.md` §3.1.
 *
 * Luu y: dung **snake_case** cho field (`snapshot_path` · `content_hash` ·
 * `key_points` · `must_include_facts` · `must_not_contain` ·
 * `expected_citations`) — vi du dataset la JSON interchange, dung chung
 * voi transcript thu cong cua Edge/Gemini.
 */
export const evalTaskSchema = z.object({
  /** Id duy nhat, dang `<group>-<nguoi-tao>-<so>`. */
  id: z.string().min(1),
  /** Nhom task. */
  group: evalGroupSchema,
  /** Ngon ngu cua task. */
  lang: evalLangSchema,
  /** Trang dung lam context. */
  page: evalPageSchema,
  /** Cau hoi dua vao side panel. */
  prompt: z.string().min(1),
  /** Cau tra loi tham chieu. */
  reference: evalReferenceSchema.optional(),
  /** So nguon trich dan ky vong (metric citation precision). */
  expected_citations: z.number().int().nonnegative().optional(),
  /** Nhan de loc dataset (VD `["news", "vi"]`). */
  tags: z.array(z.string().min(1)).optional(),
  /** Ghi chu cho nguoi cham / run (VD provider limitation). */
  notes: z.string().optional(),
  /**
   * Cac trang **bo sung** cho task (nhom `cross_tab` — 2–3 tab).
   *
   * Snapshot cua tung trang nam trong `apps/eval/dataset/snapshots/`.
   * `page` luon la trang dau tien → `pages` chi them cac trang con lai.
   */
  pages: z.array(evalPageSchema).optional(),
  /** Asset dinh kem (anh / PDF) cho task. */
  assets: z.array(evalAssetSchema).optional(),
  /**
   * Che do gui context (mac dinh `'page'`).
   *
   * Nhom `general_qa` dung `'none'` → request khong co payload `context`
   * → do duong "chat thuan LLM" (FC-12).
   */
  context_mode: evalContextModeSchema.optional(),
})
export type EvalTask = z.infer<typeof evalTaskSchema>

/** Dataset la mot mang task. */
export const evalTaskListSchema = z.array(evalTaskSchema)
export type EvalTaskList = z.infer<typeof evalTaskListSchema>

/**
 * Diem rubric 1–5 do LLM-as-judge cham (T-M2-14).
 *
 * R6 (UX & Latency) va R8 (Overall usefulness) **khong** do judge LLM →
 * cham boi con nguoi o Tang B (`EVAL_PLAN.md` §4.1 · §4.3).
 *
 * Diem duoc **clamp** ve `[1, 5]` khi parse:
 *  - Judge LLM thi thoong tra `0` cho tieu chi "khong ap dung" (VD R5 khi
 *    cau tra loi khong co trich dan) → `0` ngoai thang chuan → clamp ve `1`
 *    (diem thap nhat) thay vi **huong toan bo ket qua** thanh `judge_error`.
 *  - `> 5` cung bi clamp ve `5` · so thuc phan nguyen cung duoc lam tron.
 *
 * **Tieu chi thieu** van bi reject (R6/R8 khong do judge → phai co du 6
 * tieu chi) → khong "sua" cai sai cua judge ma chi sua diem ngoai thang chuan.
 */
const clampScore = (value: number): number => Math.min(5, Math.max(1, Math.round(value)))

/** 6 tieu chi bat buoc co trong ket qua judge. */
const JUDGE_SCORE_KEYS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R7'] as const

/**
 * Chuan hoa `scores` truoc khi validate.
 *
 * - Gia tri **co mat** → clamp ve `[1, 5]` (ke ca so thuc phan nguyen).
 * - Gia tri **khong phai so** → `1` (diem thap nhat).
 * - Gia tri **thieu hoan toan** → giữ nguyên thiếu → `z.object` reject.
 *
 * @param value - Gia tri `scores` tho.
 */
function normalizeJudgeScores(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value

  const source = value as Record<string, unknown>
  const result: Record<string, unknown> = { ...source }

  for (const key of JUDGE_SCORE_KEYS) {
    const raw = source[key]
    if (raw === undefined) continue
    result[key] = typeof raw === 'number' && Number.isFinite(raw) ? clampScore(raw) : 1
  }

  return result
}

export const evalJudgeScoresSchema = z.preprocess(normalizeJudgeScores, z.object({
  /** Groundedness — cau tra loi bam dung nguon. */
  R1: z.number().int().min(1).max(5),
  /** Correctness / Relevance. */
  R2: z.number().int().min(1).max(5),
  /** Completeness. */
  R3: z.number().int().min(1).max(5),
  /** Instruction following. */
  R4: z.number().int().min(1).max(5),
  /** Citation quality. */
  R5: z.number().int().min(1).max(5),
  /** Privacy transparency. */
  R7: z.number().int().min(1).max(5),
}))
export type EvalJudgeScores = z.infer<typeof evalJudgeScoresSchema>

/**
 * Ket qua cham cua LLM-as-judge cho 1 cau tra loi (T-M2-14).
 *
 * Shape khop **chinh xac** output schema trong `EVAL_PLAN.md` §4.3 →
 * judge tra JSON → validate bang schema nay → loi parse = `judge_error`
 * (khong tinh diem 0 — tranh "phan biet do model" sai lech).
 */
export const evalJudgeResultSchema = z.object({
  /** Diem 6 tieu chi R1, R2, R3, R4, R5, R7. */
  scores: evalJudgeScoresSchema,
  /** Diem chinh biet thieu trong cau tra loi. */
  missing_key_points: z.array(z.string()).default([]),
  /** Claim khong co trong nguon (biet) — dung tinh `hallucination_rate`. */
  hallucinated_claims: z.array(z.string()).default([]),
  /** Kiem tra trich dan: so trich dan thuoc va so trong do xac minh duoc. */
  citation_check: z
    .object({
      cited: z.number().int().nonnegative(),
      verified: z.number().int().nonnegative(),
    })
    .default({ cited: 0, verified: 0 }),
  /** Ly do cham (toi da 120 tu theo prompt). */
  reasoning: z.string().default(''),
})
export type EvalJudgeResult = z.infer<typeof evalJudgeResultSchema>
