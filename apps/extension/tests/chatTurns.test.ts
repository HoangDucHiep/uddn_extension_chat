import { describe, expect, it } from 'vitest'
import {
  activePathMessages,
  applyVariantSwitch,
  branchPath,
  buildHistory,
  groupTurns,
  offPathTurns,
  variantLabel,
  type TurnMessage,
} from '../src/lib/chatTurns'

/**
 * Tao message test nhanh.
 *
 * @param overrides - Cac truong ghi de.
 */
function message(overrides: Partial<TurnMessage> & { id: string }): TurnMessage {
  return {
    role: 'assistant',
    content: '',
    ...overrides,
  }
}

describe('chatTurns', () => {
  describe('groupTurns', () => {
    it('gom user message + assistant variants vao cung 1 turn', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', content: 'xin chao', turnId: 't1' }),
        message({ id: 'a1', content: 'chao ban', turnId: 't1', variantIndex: 0, active: true }),
        message({ id: 'a2', content: 'chao again', turnId: 't1', variantIndex: 1, active: false }),
      ]

      const groups = groupTurns(messages)

      expect(groups).toHaveLength(1)
      expect(groups[0]?.turnId).toBe('t1')
      expect(groups[0]?.userMessage?.id).toBe('u1')
      expect(groups[0]?.variants.map((v) => v.id)).toEqual(['a1', 'a2'])
      expect(groups[0]?.activeVariant?.id).toBe('a1')
      expect(groups[0]?.userContent).toBe('xin chao')
    })

    it('sap xep bien the theo variantIndex', () => {
      const messages: TurnMessage[] = [
        message({ id: 'a2', turnId: 't1', variantIndex: 1 }),
        message({ id: 'a0', turnId: 't1', variantIndex: 0 }),
      ]

      expect(groupTurns(messages)[0]?.variants.map((v) => v.id)).toEqual(['a0', 'a2'])
    })

    it('message khong co turnId → turn rieng (du lieu cu)', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', content: 'cau hoi' }),
        message({ id: 'a1', content: 'tra loi' }),
      ]

      const groups = groupTurns(messages)
      expect(groups).toHaveLength(2)
      expect(groups[0]?.turnId).toBe('legacy-u1')
      expect(groups[1]?.turnId).toBe('legacy-a1')
    })

    it('khong co bien the active → chon bien the dau tien', () => {
      const messages: TurnMessage[] = [
        message({ id: 'a0', turnId: 't1', variantIndex: 0, active: false }),
        message({ id: 'a1', turnId: 't1', variantIndex: 1, active: false }),
      ]

      expect(groupTurns(messages)[0]?.activeVariant?.id).toBe('a0')
    })
  })

  describe('activePathMessages', () => {
    it('chi giu user + bien the active cua turn tren path', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', content: 'cau 1', turnId: 't1' }),
        message({ id: 'a1', content: 'tra loi 1', turnId: 't1', variantIndex: 0, active: false }),
        message({ id: 'a2', content: 'tra loi 1b', turnId: 't1', variantIndex: 1, active: true }),
        message({ id: 'u2', role: 'user', content: 'cau 2', turnId: 't2' }),
        message({ id: 'a3', content: 'tra loi 2', turnId: 't2', variantIndex: 0, active: true }),
      ]

      const visible = activePathMessages(messages, ['t1', 't2'])

      expect(visible.map((m) => m.id)).toEqual(['u1', 'a2', 'u2', 'a3'])
    })

    it('bo qua turn khong nam trong path (nhanh cu)', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', content: 'cau 1', turnId: 't1' }),
        message({ id: 'a1', content: 'tra loi 1', turnId: 't1', variantIndex: 0, active: true }),
        message({ id: 'u2', role: 'user', content: 'cau 2', turnId: 't2' }),
        message({ id: 'a2', content: 'tra loi 2', turnId: 't2', variantIndex: 0, active: true }),
      ]

      const visible = activePathMessages(messages, ['t2'])

      expect(visible.map((m) => m.id)).toEqual(['u2', 'a2'])
    })

    it('path rong → tra ve tat ca message', () => {
      const messages: TurnMessage[] = [message({ id: 'a1', content: 'x' })]

      expect(activePathMessages(messages, [])).toHaveLength(1)
    })
  })

  describe('offPathTurns', () => {
    it('tra ve cac turn da bi cat khoi path', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', content: 'cau 1', turnId: 't1' }),
        message({ id: 'u2', role: 'user', content: 'cau 2', turnId: 't2' }),
      ]

      const off = offPathTurns(messages, ['t1'])

      expect(off).toHaveLength(1)
      expect(off[0]?.turnId).toBe('t2')
      expect(off[0]?.onPath).toBe(false)
      expect(off[0]?.userContent).toBe('cau 2')
    })
  })

  describe('applyVariantSwitch', () => {
    it('bat bien the moi, tat bien the cu', () => {
      const messages: TurnMessage[] = [
        message({ id: 'a0', turnId: 't1', variantIndex: 0, active: true }),
        message({ id: 'a1', turnId: 't1', variantIndex: 1, active: false }),
        message({ id: 'a2', turnId: 't2', variantIndex: 0, active: true }),
      ]

      const next = applyVariantSwitch(messages, 't1', 1)

      expect(next[0]?.active).toBe(false)
      expect(next[1]?.active).toBe(true)
      // Turn khac khong doi.
      expect(next[2]?.active).toBe(true)
    })

    it('khong doi user message', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', turnId: 't1', active: true }),
      ]

      expect(applyVariantSwitch(messages, 't1', 0)[0]?.active).toBe(true)
    })
  })

  describe('variantLabel', () => {
    it('chi 1 bien the → khong nhan', () => {
      const variants = [message({ id: 'a0', variantIndex: 0 })]

      expect(variantLabel(variants, variants[0])).toBeUndefined()
    })

    it('nhieu bien the → "2/3"', () => {
      const variants = [
        message({ id: 'a0', variantIndex: 0 }),
        message({ id: 'a1', variantIndex: 1 }),
        message({ id: 'a2', variantIndex: 2 }),
      ]

      expect(variantLabel(variants, variants[1])).toBe('2/3')
    })
  })

  describe('branchPath', () => {
    it('cat duong di tai turn cha', () => {
      expect(branchPath(['t1', 't2', 't3'], 't2')).toEqual(['t1', 't2'])
    })

    it('turn cha khong ton tai → giu nguyen path', () => {
      expect(branchPath(['t1', 't2'], 'tx')).toEqual(['t1', 't2'])
    })
  })

  describe('buildHistory', () => {
    it('chi dung user + bien the active, bo message rong', () => {
      const messages: TurnMessage[] = [
        message({ id: 'u1', role: 'user', content: 'cau 1', turnId: 't1' }),
        message({ id: 'a1', content: 'tra loi 1', turnId: 't1', variantIndex: 0, active: true }),
        message({ id: 'a2', content: '', turnId: 't1', variantIndex: 1, active: false }),
      ]

      expect(buildHistory(messages, ['t1'])).toEqual([
        { role: 'user', content: 'cau 1' },
        { role: 'assistant', content: 'tra loi 1' },
      ])
    })
  })
})
