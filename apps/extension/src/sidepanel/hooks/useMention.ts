import { useCallback, useRef, useState } from 'react'

/**
 * Hook `useMention` — phat hien token `@` va thay the bang ten tab
 * (T-M1-05, FR-CONTEXT-03).
 *
 * Quy tac:
 *  - Chi bat popover khi `@` bat dau mot token moi (dau text hoac sau khoang
 *    trang) → `@` trong email (`a@b.com`) khong bat.
 *  - Token chi gom ky tu khong co khoang trang.
 *  - Sau khi nguoi dung bam `Escape`, popover KHONG tu mo lai cho token
 *    dang ghep do. Token moi (vi tri khac) hoac ghi them ky tu → mo lai.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3
 */

/** Regex khop token `@` dang ghep o cuoi con tro. */
const MENTION_TOKEN = /@([^\s@]*)$/

export interface MentionMatch {
  /** Chuoi da go sau dau `@`. */
  query: string
  /** Vi tri bat dau cua token `@` trong chuoi goc. */
  start: number
  /** Vi tri ket thuc cua token trong chuoi goc. */
  end: number
}

/**
 * Tim token `@` dang ghep truoc con tro.
 *
 * @param value - Noi dung hien tai cua textarea.
 * @param cursor - Vi tri con tro (chi so ky tu).
 * @returns `undefined` khi khong co token `@` hop le.
 */
export function findMention(value: string, cursor: number): MentionMatch | undefined {
  if (cursor < 0 || cursor > value.length) return undefined

  const before = value.slice(0, cursor)
  const match = MENTION_TOKEN.exec(before)
  if (match === null) return undefined

  // `@` phai bat dau mot token moi: truoc do la dau chuoi hoac khoang trang.
  const tokenLength = match[0]?.length ?? 0
  const charBefore = before.charAt(before.length - tokenLength - 1)
  if (charBefore.length > 0 && !/\s/.test(charBefore)) return undefined

  return {
    query: match[1] ?? '',
    start: cursor - tokenLength,
    end: cursor,
  }
}

export interface MentionState {
  /** Popover co dang mo hay khong. */
  open: boolean
  /** Chuoi da go sau dau `@` (dung de loc danh sach tab). */
  query: string
}

export interface UseMentionResult {
  /** Trang thai hien tai cua popover. */
  state: MentionState
  /** Cap nhat trang thai theo text + con tro hien tai. */
  sync: (value: string, cursor: number) => void
  /** Dong popover (Esc, chon xong, blur...). */
  close: () => void
  /**
   * Thay token `@query` bang `@label ` va tra ve vi tri con tro moi.
   *
   * @param value - Noi dung hien tai cua textarea.
   * @param cursor - Vi tri con tro hien tai.
   * @param label - Ten se hien thi trong textarea (vd tieu de tab).
   */
  apply: (value: string, cursor: number, label: string) => { value: string; cursor: number }
}

/**
 * Hook quan ly trang thai mention.
 */
export function useMention(): UseMentionResult {
  const [state, setState] = useState<MentionState>({ open: false, query: '' })

  // Token dang ghep moi nhat → dung cho `close()` biet token nao bi tat.
  const currentRef = useRef<MentionMatch | undefined>(undefined)
  // Token da bi nguoi dung tat → khong tu mo lai.
  const dismissedRef = useRef<MentionMatch | undefined>(undefined)

  const sync = useCallback((value: string, cursor: number) => {
    const match = findMention(value, cursor)

    if (match === undefined) {
      currentRef.current = undefined
      dismissedRef.current = undefined
      setState((prev) => (prev.open ? { open: false, query: '' } : prev))
      return
    }

    // Cung mot token da bi tat → giu nguyen dong (ke ca khi user go them
    // ky tu vao token do).
    const dismissed = dismissedRef.current
    if (dismissed !== undefined && dismissed.start === match.start) {
      currentRef.current = match
      setState((prev) => (prev.open ? { open: false, query: '' } : prev))
      return
    }
    dismissedRef.current = undefined
    currentRef.current = match

    setState((prev) =>
      prev.open && prev.query === match.query ? prev : { open: true, query: match.query },
    )
  }, [])

  const close = useCallback(() => {
    // Snapshot token dang ghep → khong mo lai khi trinh duyet ban `select`
    // event sau khi nguoi dung bam Escape.
    dismissedRef.current = currentRef.current
    setState((prev) => (prev.open ? { open: false, query: '' } : prev))
  }, [])

  const apply = useCallback((value: string, cursor: number, label: string) => {
    const match = findMention(value, cursor)
    if (match === undefined) return { value, cursor }

    const replacement = `@${label} `
    const nextValue = value.slice(0, match.start) + replacement + value.slice(match.end)
    // Token da duoc thay the → reset trang thai tat.
    currentRef.current = undefined
    dismissedRef.current = undefined
    return { value: nextValue, cursor: match.start + replacement.length }
  }, [])

  return { state, sync, close, apply }
}
