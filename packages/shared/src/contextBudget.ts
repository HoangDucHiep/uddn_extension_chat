/**
 * Thu vien ngan sach context — uoc luong token + cat bot thong minh.
 *
 * Dung chung cho extension (hien thi meter "da dung X/Y token") va server
 * (cat lai lai truoc khi goi provider — server la nguon chan su that).
 *
 * Thu tu uu tien khi cat: `selection` > `attachment` > `currentTab` > `history`.
 *
 * Docs: docs/SYSTEM_DESIGN.md §4.1, §8 (FR-CONTEXT-07)
 */

import { CONTEXT_SAFETY_MARGIN_TOKENS } from './constants.js'
import {
  CONTEXT_ITEM_TIERS,
  type ChatTurn,
  type ContextItem,
} from './schemas/chat.js'

/**
 * So ky tu uoc luong cho 1 token.
 *
 * Heuristic don gian (khong them dependency tokenizer) — sai so voi token
 * that cua provider, nhung du cho canh bao "sap tran" trong UI.
 */
export const CHARS_PER_TOKEN = 4

/**
 * Uoc luong so token cua mot chuoi.
 *
 * Heuristic: `ceil(len / 4)`. Tai day con dung `usage` event tu provider de
 * hien thi so token thật (T-M2-03).
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

/** Tham so ngan sach context. */
export interface ContextBudgetOptions {
  /** Context window cua provider (token). */
  contextWindow: number
  /** Token danh rieng cho output cua model. */
  reservedOutputTokens: number
  /** Ngan sach tối đa cho context (bo qua khi truyền `contextWindow`). */
  maxTokens?: number
}

/** Mot context item sau khi da ap dung ngan sach. */
export interface BudgetedContextItem extends ContextItem {
  /** Item da bi cat bo mot phan. */
  truncated: boolean
  /** So ky tu bi cat khoi `text`. */
  droppedChars: number
  /** So token uoc luong cua item sau khi cat. */
  tokens: number
}

/** Ket qua ap dung ngan sach context. */
export interface ContextBudgetResult {
  /** Cac item da duoc cat bo theo thu tu uu tien. */
  items: BudgetedContextItem[]
  /** Tong token da dung cho context. */
  usedTokens: number
  /** Ngan sach toi da cho context. */
  maxTokens: number
  /** Token con lai cho lich su hoi thoai. */
  historyBudget: number
  /** So item bi bo hoan toan (khong con cho nao). */
  droppedItems: number
}

/**
 * Ap dung ngan sach context cho danh sach item.
 *
 * Cap phat theo thu tu uu tien: `selection` giu tron, `attachment` giu tron
 * neu con cho, `currentTab` chi dung phan du. Item vuot chỗ bi cat phan dau
 * (head slice) va danh dau `truncated`.
 *
 * Phan du sau khi cat context duoc dua sang `historyBudget` cho lich su chat.
 */
export function applyContextBudget(
  items: readonly ContextItem[],
  options: ContextBudgetOptions,
): ContextBudgetResult {
  const maxTokens = Math.max(
    0,
    options.maxTokens ??
      options.contextWindow -
        options.reservedOutputTokens -
        CONTEXT_SAFETY_MARGIN_TOKENS,
  )

  const result: BudgetedContextItem[] = []
  let remaining = maxTokens
  let droppedItems = 0

  for (const tier of CONTEXT_TIER_ORDER) {
    for (const item of items) {
      if (item.tier !== tier) continue

      const text = item.text ?? ''
      const tokens = estimateTokens(text)

      if (tokens <= remaining) {
        result.push({ ...item, truncated: false, droppedChars: 0, tokens })
        remaining -= tokens
        continue
      }

      // Khong du cho — cat phan dau neu con it nhat mot ky tu.
      const allowedChars = remaining * CHARS_PER_TOKEN
      if (allowedChars > 0 && text.length > 0) {
        const sliced = text.slice(0, allowedChars)
        const usedTokens = estimateTokens(sliced)
        result.push({
          ...item,
          text: sliced,
          truncated: true,
          droppedChars: text.length - sliced.length,
          tokens: usedTokens,
        })
        remaining -= usedTokens
        continue
      }

      droppedItems += 1
    }
  }

  return {
    items: result,
    usedTokens: maxTokens - remaining,
    maxTokens,
    historyBudget: remaining,
    droppedItems,
  }
}

/**
 * Thu tu uu tien cap phat ngan sach (cao → thap).
 *
 * `history` khong la item context — no duoc xu ly rieng boi `trimHistory`.
 */
export const CONTEXT_TIER_ORDER: readonly ContextItem['tier'][] = CONTEXT_ITEM_TIERS

/**
 * Cat lich su hoi thoai cho vua ngan sach.
 *
 * Giu cac luot moi nhat truoc; luot cuoi cung (cau hoi hien tai) LUON duoc
 * giu lai du ngan sach bi tran.
 */
export function trimHistory(turns: readonly ChatTurn[], maxTokens: number): ChatTurn[] {
  if (turns.length === 0) return []

  const kept: ChatTurn[] = []
  let used = 0

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index]
    if (turn === undefined) continue

    const tokens = estimateTokens(turn.content)

    if (index === turns.length - 1) {
      // Luot moi nhat (cau hoi hien tai) — luon giu.
      kept.unshift(turn)
      used += tokens
      continue
    }

    if (used + tokens > maxTokens) break
    kept.unshift(turn)
    used += tokens
  }

  return kept
}
