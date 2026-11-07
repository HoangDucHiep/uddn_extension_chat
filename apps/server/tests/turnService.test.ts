import { describe, expect, it } from 'vitest'
import {
  activeVariantIndex,
  buildTurns,
  derivePath,
  nextVariantIndex,
  normalizeMessages,
  type RawMessage,
} from '../src/services/turnService.js'

/**
 * Tao message tho nhanh.
 *
 * @param overrides - Cac truong ghi de.
 */
function raw(overrides: Partial<RawMessage> & { id: string }): RawMessage {
  return {
    role: 'assistant',
    content: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('turnService', () => {
  describe('normalizeMessages', () => {
    it('doc turnId/variantIndex/active tu meta', () => {
      const result = normalizeMessages([
        raw({
          id: 'u1',
          role: 'user',
          meta: { turnId: 't1', variantIndex: 0, active: true },
        }),
        raw({
          id: 'a1',
          meta: { turnId: 't1', variantIndex: 0, active: true },
        }),
      ])

      expect(result[0]?.turnId).toBe('t1')
      expect(result[1]?.turnId).toBe('t1')
      expect(result[0]?.active).toBe(true)
    })

    it('message khong co meta.turnId → user bat dau turn moi, assistant gan turn truoc', () => {
      const result = normalizeMessages([
        raw({ id: 'u1', role: 'user' }),
        raw({ id: 'a1' }),
        raw({ id: 'u2', role: 'user' }),
        raw({ id: 'a2' }),
      ])

      expect(result[0]?.turnId).toBe('legacy-u1')
      expect(result[1]?.turnId).toBe('legacy-u1')
      expect(result[2]?.turnId).toBe('legacy-u2')
      expect(result[3]?.turnId).toBe('legacy-u2')
    })

    it('active mac dinh true khi meta khong khai bao', () => {
      const result = normalizeMessages([raw({ id: 'a1' })])

      expect(result[0]?.active).toBe(true)
    })

    it('assistant bien the dem theo thu tu trong turn', () => {
      const result = normalizeMessages([
        raw({ id: 'u1', role: 'user', meta: { turnId: 't1' } }),
        raw({ id: 'a1', meta: { turnId: 't1' } }),
        raw({ id: 'a2', meta: { turnId: 't1' } }),
      ])

      expect(result[1]?.variantIndex).toBe(0)
      expect(result[2]?.variantIndex).toBe(1)
    })

    it('user message luon variantIndex 0', () => {
      const result = normalizeMessages([
        raw({ id: 'u1', role: 'user', meta: { turnId: 't1', variantIndex: 7 } }),
      ])

      expect(result[0]?.variantIndex).toBe(7)
    })

    it('doc aborted/parentTurnId tu meta', () => {
      const result = normalizeMessages([
        raw({
          id: 'a1',
          meta: { turnId: 't1', aborted: true, parentTurnId: 't0' },
        }),
      ])

      expect(result[0]?.aborted).toBe(true)
      expect(result[0]?.parentTurnId).toBe('t0')
    })
  })

  describe('derivePath', () => {
    it('duong di = thu tu xuat hien lan dau cua turn', () => {
      const normalized = normalizeMessages([
        raw({ id: 'u1', role: 'user', meta: { turnId: 't1' } }),
        raw({ id: 'a1', meta: { turnId: 't1' } }),
        raw({ id: 'u2', role: 'user', meta: { turnId: 't2' } }),
      ])

      expect(derivePath(normalized)).toEqual(['t1', 't2'])
    })

    it('khong lap lai turn da xuat hien', () => {
      const normalized = normalizeMessages([
        raw({ id: 'u1', role: 'user', meta: { turnId: 't1' } }),
        raw({ id: 'u2', role: 'user', meta: { turnId: 't2' } }),
        raw({ id: 'a2', meta: { turnId: 't1' } }),
      ])

      expect(derivePath(normalized)).toEqual(['t1', 't2'])
    })
  })

  describe('nextVariantIndex', () => {
    it('tra chi so bien the tiep theo', () => {
      const normalized = normalizeMessages([
        raw({ id: 'u1', role: 'user', meta: { turnId: 't1' } }),
        raw({ id: 'a1', meta: { turnId: 't1', variantIndex: 0 } }),
        raw({ id: 'a2', meta: { turnId: 't1', variantIndex: 1 } }),
      ])

      expect(nextVariantIndex(normalized, 't1')).toBe(2)
    })

    it('turn chua co bien the → 0', () => {
      const normalized = normalizeMessages([
        raw({ id: 'u1', role: 'user', meta: { turnId: 't1' } }),
      ])

      expect(nextVariantIndex(normalized, 't1')).toBe(0)
    })
  })

  describe('activeVariantIndex', () => {
    it('tra bien the dang active', () => {
      const normalized = normalizeMessages([
        raw({ id: 'a0', meta: { turnId: 't1', variantIndex: 0, active: false } }),
        raw({ id: 'a1', meta: { turnId: 't1', variantIndex: 1, active: true } }),
      ])

      expect(activeVariantIndex(normalized, 't1')).toBe(1)
    })

    it('khong co bien the active → bien the dau tien', () => {
      const normalized = normalizeMessages([
        raw({ id: 'a0', meta: { turnId: 't1', variantIndex: 0, active: false } }),
        raw({ id: 'a1', meta: { turnId: 't1', variantIndex: 1, active: false } }),
      ])

      expect(activeVariantIndex(normalized, 't1')).toBe(0)
    })
  })

  describe('buildTurns', () => {
    it('gom turn + bien the + onPath', () => {
      const normalized = normalizeMessages([
        raw({ id: 'u1', role: 'user', content: 'cau 1', meta: { turnId: 't1' } }),
        raw({
          id: 'a1',
          content: 'tra loi 1',
          meta: { turnId: 't1', variantIndex: 0, active: true },
        }),
        raw({
          id: 'a2',
          content: 'tra loi 1b',
          meta: { turnId: 't1', variantIndex: 1, active: false },
        }),
        raw({ id: 'u2', role: 'user', content: 'cau 2', meta: { turnId: 't2' } }),
      ])

      const turns = buildTurns(normalized, ['t1'])

      expect(turns).toHaveLength(2)
      expect(turns[0]?.turnId).toBe('t1')
      expect(turns[0]?.userMessageId).toBe('u1')
      expect(turns[0]?.userContent).toBe('cau 1')
      expect(turns[0]?.onPath).toBe(true)
      expect(turns[0]?.variants).toHaveLength(2)
      expect(turns[0]?.variants[0]?.active).toBe(true)
      expect(turns[1]?.onPath).toBe(false)
    })
  })
})
