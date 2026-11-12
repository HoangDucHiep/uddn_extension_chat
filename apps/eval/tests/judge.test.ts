import { describe, expect, it } from 'vitest'
import { extractJsonPayload } from '../src/judge/run_judge.js'
import { buildJudgeUserMessage, truncateAtBoundary } from '../src/judge/prompt.js'

/**
 * Test LLM-as-judge (T-M2-14).
 *
 * AC goc:
 *  - Judge tra JSON trong fence ``` ```json ``` ``` → parse duoc.
 *  - JSON khong hop schema → `judge_error` (khong tinh diem 0).
 *  - Prompt co day du 4 phan: QUESTION · SOURCE MATERIAL · RESPONSE · reference.
 *
 * Docs: docs/EVAL_PLAN.md §4.3
 */

describe('extractJsonPayload', () => {
  it('parse JSON thu', () => {
    const payload = extractJsonPayload('{"scores":{"R1":5}}')
    expect(payload).toBe('{"scores":{"R1":5}}')
  })

  it('boc fence ``` ```json ``` ```', () => {
    const raw = '```json\n{"scores":{"R1":4}}\n```'
    expect(extractJsonPayload(raw)).toBe('{"scores":{"R1":4}}')
  })

  it('boc fence khong co nhan json', () => {
    const raw = '```\n{"scores":{"R1":4}}\n```'
    expect(extractJsonPayload(raw)).toBe('{"scores":{"R1":4}}')
  })

  it('bo text thua truoc/sau JSON', () => {
    const raw = 'Here is my evaluation:\n{"scores":{"R1":3}}\nHope it helps.'
    expect(extractJsonPayload(raw)).toBe('{"scores":{"R1":3}}')
  })

  it('tra undefined khong phai JSON', () => {
    expect(extractJsonPayload('I cannot evaluate this.')).toBeUndefined()
  })

  it('tra undefined khi JSON hong', () => {
    expect(extractJsonPayload('{"scores": ')).toBeUndefined()
  })
})

describe('buildJudgeUserMessage', () => {
  const base = {
    question: 'Python la gi?',
    sourceMaterial: 'Python la ngon ngu lap trinh cap cao.',
    response: 'Python la ngon ngu lap trinh cap cao.',
  }

  it('co du 4 phan bat buoc', () => {
    const message = buildJudgeUserMessage(base)
    expect(message).toContain('## USER QUESTION')
    expect(message).toContain('## SOURCE MATERIAL')
    expect(message).toContain('## ASSISTANT RESPONSE')
    expect(message).toContain('## TASK')
  })

  it('them KEY POINTS khi co', () => {
    const message = buildJudgeUserMessage({ ...base, keyPoints: ['diem 1', 'diem 2'] })
    expect(message).toContain('## KEY POINTS THE ANSWER SHOULD COVER')
    expect(message).toContain('- diem 1')
  })

  it('them MUST APPEAR khi co', () => {
    const message = buildJudgeUserMessage({ ...base, mustIncludeFacts: ['87%'] })
    expect(message).toContain('## FACTS THAT MUST APPEAR')
    expect(message).toContain('- 87%')
  })

  it('them MUST NOT APPEAR khi co', () => {
    const message = buildJudgeUserMessage({ ...base, mustNotContain: ['Java'] })
    expect(message).toContain('## CONTENT THAT MUST NOT APPEAR')
  })

  it('khong them section rong', () => {
    const message = buildJudgeUserMessage({ ...base, keyPoints: [] })
    expect(message).not.toContain('## KEY POINTS THE ANSWER SHOULD COVER')
  })

  it('them CITATIONS khi co danh sach nguon', () => {
    const message = buildJudgeUserMessage({
      ...base,
      citations: [
        { index: 1, url: 'https://example.com/a', title: 'Trang A', snippet: 'doan trich' },
      ],
    })
    expect(message).toContain('## CITATIONS PROVIDED BY THE ASSISTANT')
    expect(message).toContain('[1] Trang A — https://example.com/a')
    expect(message).toContain('doan trich')
  })

  it('khong them section CITATIONS khi khong co trich dan', () => {
    const message = buildJudgeUserMessage({ ...base, citations: [] })
    expect(message).not.toContain('## CITATIONS PROVIDED BY THE ASSISTANT')
  })
})

describe('truncateAtBoundary', () => {
  it('khong cat chuoi ngan', () => {
    expect(truncateAtBoundary('ngan', 100)).toBe('ngan')
  })

  it('cat tai ranh giua doan', () => {
    const source = `${'doan mot '.repeat(20)}\n\n${'doan hai '.repeat(20)}`
    const result = truncateAtBoundary(source, 200)
    expect(result.length).toBeLessThan(source.length)
    expect(result).toContain('nội dung bị cắt')
  })
})
