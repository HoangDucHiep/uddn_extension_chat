import { describe, expect, it } from 'vitest'
import {
  RESERVED_CHROME_SHORTCUTS,
  SHORTCUT_COMMANDS,
  formatShortcutLabel,
  isReservedShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutFromKeyboardEvent,
} from '@/lib/shortcuts'

/**
 * Test logic phim tat thuan (T-M1-18, FR-UX-01).
 *
 * Khong dung `chrome.*` → chay duoc trong jsdom.
 */
describe('shortcuts', () => {
  describe('normalizeShortcut', () => {
    it('chuẩn hoá thu tu modifier', () => {
      expect(normalizeShortcut('shift+ctrl+k')).toBe('Ctrl+Shift+K')
      expect(normalizeShortcut('ctrl+shift+k')).toBe('Ctrl+Shift+K')
      expect(normalizeShortcut('Shift+Ctrl+Alt+K')).toBe('Ctrl+Alt+Shift+K')
    })

    it('chấp nhận alias modifier', () => {
      // Thu tu modifier chuan hoa: Ctrl → Alt → Shift → Meta.
      expect(normalizeShortcut('cmd+shift+k')).toBe('Shift+Meta+K')
      expect(normalizeShortcut('control+alt+shift+p')).toBe('Ctrl+Alt+Shift+P')
      expect(normalizeShortcut('option+k')).toBe('Alt+K')
    })

    it('viết hoa phim chinh', () => {
      expect(normalizeShortcut('ctrl+k')).toBe('Ctrl+K')
      expect(normalizeShortcut('ctrl+1')).toBe('Ctrl+1')
      expect(normalizeShortcut('ctrl+f5')).toBe('Ctrl+F5')
    })

    it('bỏ qua modifier trùng lặp', () => {
      expect(normalizeShortcut('ctrl+ctrl+k')).toBe('Ctrl+K')
    })

    it('trả undefined khi input rỗng hoặc sai', () => {
      expect(normalizeShortcut('')).toBeUndefined()
      expect(normalizeShortcut('   ')).toBeUndefined()
      expect(normalizeShortcut('ctrl+')).toBeUndefined()
      expect(normalizeShortcut('ctrl')).toBeUndefined()
      expect(normalizeShortcut('ctrl+a+b')).toBeUndefined()
      expect(normalizeShortcut('ctrl+notakey')).toBeUndefined()
      expect(normalizeShortcut('ctrl+f13')).toBeUndefined()
    })
  })

  describe('isReservedShortcut', () => {
    it('chặn to hop danh riêng cua trinh duyet', () => {
      expect(isReservedShortcut('Ctrl+T')).toBe(true)
      expect(isReservedShortcut('Ctrl+Shift+N')).toBe(true)
      expect(isReservedShortcut('F5')).toBe(true)
      expect(isReservedShortcut('Ctrl+Shift+Delete')).toBe(true)
      expect(isReservedShortcut('Alt+F4')).toBe(true)
      expect(isReservedShortcut('Ctrl+9')).toBe(true)
    })

    it('khong chan to hop thuong', () => {
      expect(isReservedShortcut('Ctrl+Shift+K')).toBe(false)
      expect(isReservedShortcut('Ctrl+Shift+J')).toBe(false)
      expect(isReservedShortcut('Alt+Shift+S')).toBe(false)
    })

    it('khong chan input khong hop le', () => {
      expect(isReservedShortcut('')).toBe(false)
      expect(isReservedShortcut('ctrl+notakey')).toBe(false)
    })

    it('danh sach reserved phai chua du cac to hop luon bi chan', () => {
      for (const reserved of RESERVED_CHROME_SHORTCUTS) {
        expect(isReservedShortcut(reserved)).toBe(true)
      }
    })
  })

  describe('parseShortcut', () => {
    it('tra ok khi hop le', () => {
      expect(parseShortcut('ctrl+shift+k')).toEqual({ ok: true, shortcut: 'Ctrl+Shift+K' })
    })

    it('tra invalid khi khong phai to hop phim', () => {
      expect(parseShortcut('ctrl+')).toEqual({ ok: false, reason: 'invalid' })
      expect(parseShortcut('hello')).toEqual({ ok: false, reason: 'invalid' })
    })

    it('tra reserved khi trung shortcut cua trinh duyet', () => {
      expect(parseShortcut('ctrl+t')).toEqual({ ok: false, reason: 'reserved' })
      expect(parseShortcut('Ctrl+Shift+W')).toEqual({ ok: false, reason: 'reserved' })
    })
  })

  describe('shortcutFromKeyboardEvent', () => {
    it('tao to hop tu modifier + phim', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
      })
      expect(shortcutFromKeyboardEvent(event)).toBe('Ctrl+Shift+K')
    })

    it('bo qua su kien chi bam modifier', () => {
      const event = new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true })
      expect(shortcutFromKeyboardEvent(event)).toBeUndefined()
    })

    it('tra Escape khi bam Esc', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      expect(shortcutFromKeyboardEvent(event)).toBe('Escape')
    })
  })

  describe('formatShortcutLabel', () => {
    it('tra undefined khi chua gan', () => {
      expect(formatShortcutLabel(undefined)).toBeUndefined()
      expect(formatShortcutLabel('')).toBeUndefined()
      expect(formatShortcutLabel('   ')).toBeUndefined()
    })

    it('tra chuoi khi da gan', () => {
      expect(formatShortcutLabel('Ctrl+Shift+K')).toBe('Ctrl+Shift+K')
    })
  })

  describe('SHORTCUT_COMMANDS', () => {
    it('phai khai bao command toggle panel', () => {
      expect(SHORTCUT_COMMANDS['sidekick-toggle-panel']).toBe(
        'settings.shortcuts.command.togglePanel',
      )
    })
  })
})
