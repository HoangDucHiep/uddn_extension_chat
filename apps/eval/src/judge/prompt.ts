/**
 * Judge prompt cho LLM-as-judge (T-M2-14).
 *
 * System prompt lay **nguyen van** tu [`EVAL_PLAN.md`](../../../../docs/EVAL_PLAN.md)
 * §4.3 → chấm điểm nhất quán, không lệch với phien ban thao tai lieu.
 *
 * Rules trong prompt:
 *  - Chi suy ra su that tu SOURCE MATERIAL (khong tu tri thức cua model).
 *  - Cham **cau tra loi nhu hien ra**, khong do "y dinh" cua model.
 *  - Tra **strict JSON**, khong co prose ben ngoai.
 *
 * Docs: docs/EVAL_PLAN.md §4.3
 */

/**
 * System prompt cua judge.
 *
 * Giu nguyen cau truc 6 tieu chi R1–R5 + R7 (R6/R8 do con nguoi cham).
 */
export const JUDGE_SYSTEM_PROMPT = `You are a strict, impartial evaluator of AI assistants.

You will be given:
- a USER QUESTION
- the SOURCE MATERIAL (ground truth context)
- the ASSISTANT RESPONSE to score

Score the response on these criteria, each 1-5:
R1 Groundedness, R2 Correctness/Relevance, R3 Completeness,
R4 Instruction following, R5 Citation quality, R7 Privacy transparency.

Rules:
- Use ONLY the SOURCE MATERIAL to verify factual claims. If a claim is not
  supported by the source, lower R1 and R2.
- The source is the ground truth, not your own world knowledge.
- Score the RESPONSE AS SHOWN, not what you imagine the model intended.
- Be strict but consistent: apply the same bar to every response.
- Do not reward length or formatting over substance.
- The ASSISTANT RESPONSE may contain inline citation markers like [1], [2].
  A CITATIONS section may be provided listing what each marker refers to.
  For citation_check.cited: count the distinct citation markers used in the
  response. For citation_check.verified: count how many of those markers
  refer to a source that actually supports the claim it is attached to.
  If no CITATIONS section is provided, set verified to 0 and do not guess.
- Return STRICT JSON, no prose outside it.

Output schema:
{
  "scores": {"R1": int, "R2": int, "R3": int, "R4": int, "R5": int, "R7": int},
  "missing_key_points": ["..."],
  "hallucinated_claims": ["..."],
  "citation_check": {"cited": int, "verified": int},
  "reasoning": "<=120 words, one short paragraph"
}`

/** Cac phan cua user message khi cham. */
export interface JudgeInput {
  /** Cau hoi user. */
  question: string
  /** Noi dung nguon (snapshot) — ground truth. */
  sourceMaterial: string
  /** Cau tra loi cua he thong can cham. */
  response: string
  /**
   * Danh sach nguon trich dan ma he thong tai len.
   *
   * Khong co danh sach nay → judge chi thay marker `[1]` trong cau tra loi →
   * khong verify duoc → `citation_check.verified = 0` va `R5` (citation
   * quality) luon thap → metric `citation_precision` vo nghia.
   */
  citations?: readonly JudgeCitation[] | undefined
  /** Diem chinh can co (tu `reference.key_points`). */
  keyPoints?: readonly string[] | undefined
  /** Facts bat buoc xuat hien (tu `reference.must_include_facts`). */
  mustIncludeFacts?: readonly string[] | undefined
  /** Noi dung cam xuat hien (tu `reference.must_not_contain`). */
  mustNotContain?: readonly string[] | undefined
}

/** 1 nguon trich dan cua he thong. */
export interface JudgeCitation {
  /** So thu tu trich dan (1-based). */
  index: number
  /** URL nguon. */
  url: string
  /** Tieu de nguon. */
  title: string
  /** Doan trich tu nguon. */
  snippet: string
}

/**
 * Gioi han do dai source material gui cho judge.
 *
 * Judge can **day du** context de verify claim → cat theo **ranh gioi
 * doan** (khong cat giua cau) de khong mat thong tin.
 *
 * Gia tri phai de con `MAX_TOTAL_CHARS` (gioi han `messages[].content` cua
 * BFF = 32 000 ky tu) — neu vuot, BFF tra `VALIDATION_ERROR` 400.
 */
const MAX_SOURCE_CHARS = 20_000

/**
 * Tong do dai toi da cua user message (BFF chap nhan toi da 32 000).
 *
 * De chung cho ca `question` + `source` + `response` + danh sach → cat
 * `source` truoc, roi cat phan du con lai theo ranh gioi doan.
 */
const MAX_TOTAL_CHARS = 31_000

/**
 * Build user message cho judge.
 *
 * @param input - Cac phan can cham.
 */
export function buildJudgeUserMessage(input: JudgeInput): string {
  const sections: string[] = []

  sections.push(`## USER QUESTION\n${input.question}`)

  /**
   * Task **khong** co tai lieu (`context_mode: 'none'`, nhom `general_qa`).
   *
   * Khong co SOURCE MATERIAL → judge **khong** the doi chieu claim voi
   * nguon → neu van cham `hallucinated_claims` thi **moi** noi dung deu
   * bi coi la "hallucination" → metric sai.
   *
   * → noi ro cho judge: dung `must_include_facts` / `key_points` de cham,
   * va **de trong** `hallucinated_claims` (khong co nguon de doi chieu).
   */
  const hasSource = input.sourceMaterial.trim().length > 0

  if (hasSource) {
    sections.push(`## SOURCE MATERIAL\n${truncateAtBoundary(input.sourceMaterial, MAX_SOURCE_CHARS)}`)
  } else {
    sections.push(
      '## SOURCE MATERIAL\n(none — this task has NO source document; the assistant answered from general knowledge only)\n' +
        'Score groundedness ONLY against KEY POINTS / FACTS THAT MUST APPEAR below.\n' +
        'Do NOT list anything in hallucinated_claims: with no source there is nothing to verify against.',
    )
  }

  sections.push(`## ASSISTANT RESPONSE\n${input.response}`)

  // Danh sach nguon trich dan → judge verify duoc marker `[N]` trong cau
  // tra loi co that su tro toi doan nguon hay khong.
  if (input.citations !== undefined && input.citations.length > 0) {
    sections.push(`## CITATIONS PROVIDED BY THE ASSISTANT\n${renderCitations(input.citations)}`)
  }

  if (input.keyPoints !== undefined && input.keyPoints.length > 0) {
    sections.push(`## KEY POINTS THE ANSWER SHOULD COVER\n${toBulletList(input.keyPoints)}`)
  }

  if (input.mustIncludeFacts !== undefined && input.mustIncludeFacts.length > 0) {
    sections.push(`## FACTS THAT MUST APPEAR\n${toBulletList(input.mustIncludeFacts)}`)
  }

  if (input.mustNotContain !== undefined && input.mustNotContain.length > 0) {
    sections.push(`## CONTENT THAT MUST NOT APPEAR\n${toBulletList(input.mustNotContain)}`)
  }

  sections.push(
    '## TASK\nScore the ASSISTANT RESPONSE against the SOURCE MATERIAL and return STRICT JSON only.',
  )

  const message = sections.join('\n\n')

  // BFF gioi han `messages[].content` <= 32 000 ky tu → cat theo ranh gioi doan.
  if (message.length <= MAX_TOTAL_CHARS) return message

  const note = `\n\n[...nội dung bị cắt do giới hạn độ dài...]`
  const safe = truncateAtBoundary(message, MAX_TOTAL_CHARS - note.length)
  return `${safe}${note}`.slice(0, MAX_TOTAL_CHARS)
}

/**
 * Render 1 danh sach thanh bullet.
 *
 * @param items - Danh sach.
 */
function toBulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n')
}

/**
 * Render danh sach nguon trich dan theo dang `[N] tieu de — url`.
 *
 * Doan trich (`snippet`) bi cat ngan de tiet kiem token (chi can de judge
 * kiem tra marker co khop nguon hay khong).
 *
 * @param citations - Danh sach nguon.
 */
function renderCitations(citations: readonly JudgeCitation[]): string {
  return citations
    .map((citation) => {
      const snippet = citation.snippet.replace(/\s+/g, ' ').trim().slice(0, 400)
      return `- [${citation.index}] ${citation.title} — ${citation.url}\n  - trích: ${snippet}`
    })
    .join('\n')
}

/**
 * Cat chuoi tai **ranh gioi doan** gan nhat (khong cat giua cau).
 *
 * @param text - Text can cat.
 * @param maxChars - Do dai toi da.
 */
export function truncateAtBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text

  const slice = text.slice(0, maxChars)
  const lastBreak = slice.lastIndexOf('\n\n')
  if (lastBreak > maxChars * 0.5) {
    return `${slice.slice(0, lastBreak).trimEnd()}\n\n[...nội dung bị cắt do giới hạn độ dài...]`
  }

  const lastSpace = slice.lastIndexOf(' ')
  const safe = lastSpace > maxChars * 0.5 ? slice.slice(0, lastSpace) : slice
  return `${safe.trimEnd()}\n\n[...nội dung bị cắt do giới hạn độ dài...]`
}
