import { useCallback, useRef, useState } from 'react'
import type { Skill } from '@sidekick/shared'

/**
 * Hook `useSkillCommand` — phat hien token `/` va chon skill (T-M2-04,
 * FR-SKILL-01).
 *
 * Quy tac:
 *  - Chi bat popover khi `/` bat dau mot token moi (dau text hoac sau khoang
 *    trang) → `/` trong URL (`example.com/x`) **khong** bat.
 *  - Token chi gom ky tu khong co khoang trang.
 *  - Sau khi nguoi dung bam `Escape`, popover KHONG tu mo lai cho token
 *    dang ghep do. Token moi (vi tri khac) hoac ghi them ky tu → mo lai.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

/** Regex khop token `/` dang ghep o cuoi con tro. */
const SKILL_TOKEN = /\/([^\s/]*)$/

export interface SkillMatch {
  /** Chuoi da go sau dau `/`. */
  query: string
  /** Vi tri bat dau cua token `/` trong chuoi goc. */
  start: number
  /** Vi tri ket thuc cua token trong chuoi goc. */
  end: number
}

/**
 * Tim token `/` dang ghep truoc con tro.
 *
 * @param value - Noi dung hien tai cua textarea.
 * @param cursor - Vi tri con tro (chi so ky tu).
 * @returns `undefined` khi khong co token `/` hop le.
 */
export function findSkillToken(value: string, cursor: number): SkillMatch | undefined {
  if (cursor < 0 || cursor > value.length) return undefined

  const before = value.slice(0, cursor)
  const match = SKILL_TOKEN.exec(before)
  if (match === null) return undefined

  // `/` phai bat dau mot token moi: truoc do la dau chuoi hoac khoang trang.
  // → `/` trong URL (`example.com/x`) hay email KHONG bat popover.
  const tokenLength = match[0]?.length ?? 0
  const charBefore = before.charAt(before.length - tokenLength - 1)
  if (charBefore.length > 0 && !/\s/.test(charBefore)) return undefined

  return {
    query: match[1] ?? '',
    start: cursor - tokenLength,
    end: cursor,
  }
}

export interface SkillCommandState {
  /** Popover co dang mo hay khong. */
  open: boolean
  /** Chuoi da go sau dau `/` (dung de loc danh sach skill). */
  query: string
}

export interface UseSkillCommandResult {
  /** Trang thai hien tai cua popover. */
  state: SkillCommandState
  /** Cap nhat trang thai theo text + con tro hien tai. */
  sync: (value: string, cursor: number) => void
  /** Dong popover (Esc, chon xong, blur...). */
  close: () => void
  /**
   * Thay token `/query` bang `/ten-skill ` va tra ve vi tri con tro moi.
   *
   * Neu khong co token `/` dang ghep (vd user bam "Dung" skill trong drawer
   * quan ly) → **chen** `/ten-skill ` vao cuoi noi dung.
   *
   * @param value - Noi dung hien tai cua textarea.
   * @param cursor - Vi tri con tro hien tai.
   * @param skill - Skill duoc chon.
   */
  apply: (value: string, cursor: number, skill: Skill) => { value: string; cursor: number }
  /**
   * Xoa token `/ten-skill` khoi noi dung (dung khi gui chat).
   *
   * @param value - Noi dung hien tai cua textarea.
   * @param skillName - Ten skill da chon (slug).
   */
  strip: (value: string, skillName: string) => string
}

/**
 * Hook quan ly trang thai menu `/`.
 */
export function useSkillCommand(): UseSkillCommandResult {
  const [state, setState] = useState<SkillCommandState>({ open: false, query: '' })

  // Token dang ghep moi nhat → dung cho `close()` biet token nao bi tat.
  const currentRef = useRef<SkillMatch | undefined>(undefined)
  // Token da bi nguoi dung tat → khong tu mo lai.
  const dismissedRef = useRef<SkillMatch | undefined>(undefined)

  const sync = useCallback((value: string, cursor: number) => {
    const match = findSkillToken(value, cursor)

    if (match === undefined) {
      currentRef.current = undefined
      dismissedRef.current = undefined
      setState((prev) => (prev.open ? { open: false, query: '' } : prev))
      return
    }

    // Cung mot token da bi tat → giu nguyen dong.
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

  const apply = useCallback((value: string, cursor: number, skill: Skill) => {
    const match = findSkillToken(value, cursor)
    const replacement = `/${skill.name} `

    // Khong co token `/` dang ghep → chen moi vao cuoi noi dung (user bam
    // "Dung" skill trong drawer quan ly skill).
    if (match === undefined) {
      const nextValue = `${value}${value.length > 0 ? ' ' : ''}${replacement}`
      currentRef.current = undefined
      dismissedRef.current = undefined
      return { value: nextValue, cursor: nextValue.length }
    }

    const nextValue = value.slice(0, match.start) + replacement + value.slice(match.end)
    // Token da duoc thay the → reset trang thai tat.
    currentRef.current = undefined
    dismissedRef.current = undefined
    return { value: nextValue, cursor: match.start + replacement.length }
  }, [])

  const strip = useCallback((value: string, skillName: string) => {
    if (skillName.length === 0) return value.trim()
    const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(^|\\s)/${escaped}(?![a-z0-9-])`, 'gi')
    return value.replace(pattern, '$1').trim()
  }, [])

  return { state, sync, close, apply, strip }
}
