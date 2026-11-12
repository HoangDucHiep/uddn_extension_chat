/**
 * Co che tu noi tiep cau tra loi khi model bi cat boi gioi han token
 * (FR-CHAT-15 — T-M2-24).
 *
 * ## Vay sao can?
 *
 * Provider bao `finish_reason = 'length'` khi model cham tran `max_tokens`
 * → cau tra loi **bi cut giua chung**. Truoc T-M2-24 client bo qua trang
 * thai nay → khong co nut "Tiep tuc" nao de bam → user bi "dut" giua chung.
 *
 * Nay server **tu noi tiep**: gui lai phan vua cat cho model, kem chi dan
 * "viet tiep phan con lai" → model viet tiep. Gioi han so vong de tranh
 * model lap vong vo han (tran token + tien).
 *
 * File nay **thuan** (khong import Zod / DB) → test duoc nhanh.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.30
 */

import { AUTO_CONTINUE_INSTRUCTION } from '@sidekick/shared'

/** 1 message gui cho provider trong vong noi tiep. */
export interface ContinuationMessage {
  role: 'assistant' | 'user'
  content: string
}

/**
 * Tham so quyet dinh tu noi tiep hay khong.
 */
export interface AutoContinueDecision {
  /** Ly do ket thuc cua vong stream vua roi. */
  finishReason: 'stop' | 'length' | 'tool' | 'aborted' | 'error'
  /** So vong auto-continue da chay. */
  autoContinueRounds: number
  /** Budget cap con cho phep chi phi them khong. */
  budgetOk: boolean
  /** So vong toi da cho phep. */
  maxRounds: number
}

/**
 * Co can tu noi tiep cau tra loi khong?
 *
 * Chi tiep khi **tat ca** dieu kien sau dung:
 *  - model bi cat do gioi han token (`finishReason === 'length'`),
 *  - chua het so vong toi da,
 *  - budget cap con cho phep.
 *
 * @param decision - Cac dieu kien cua luot hien tai.
 * @returns `true` neu nen tu noi tiep.
 */
export function shouldAutoContinue(decision: AutoContinueDecision): boolean {
  if (decision.finishReason !== 'length') return false
  if (!decision.budgetOk) return false
  return decision.autoContinueRounds < decision.maxRounds
}

/**
 * Tao 2 message de model viet tiep phan vua bi cat.
 *
 * - `assistant` = phan text **vua sinh ra trong vong hien tai** (khong phai
 *   tong tich luy) → model biet no vua viet gi.
 * - `user` = chi dan "viet tiep" → model chi viet phan con lai, khong lap lai.
 *
 * Dung `AUTO_CONTINUE_INSTRUCTION` (khong phai `CONTINUE_INSTRUCTION`) →
 * model **khong** tu viet loi giai thich "bi gioi han hien thi" (FR-CHAT-15).
 *
 * @param roundText - Text sinh ra trong vong stream vua roi.
 * @returns 2 message (assistant roi user).
 */
export function buildContinuationMessages(roundText: string): ContinuationMessage[] {
  return [
    { role: 'assistant', content: roundText },
    { role: 'user', content: AUTO_CONTINUE_INSTRUCTION },
  ]
}
