import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDensity,
  applyFontScale,
  applyPanelWidth,
  applyTheme,
  prefersDarkScheme,
  watchSystemTheme,
} from '../src/lib/theme'

/**
 * Unit test cho lop ap theme/font/panel len DOM (FR-SETTINGS-01/02 — T-M1-12).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.14
 */

/** Khoi phuc `<html>` sau moi test. */
function resetHtml(): void {
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
}

describe('applyTheme', () => {
  beforeEach(() => {
    resetHtml()
  })

  it('bat class .dark khi theme dark', () => {
    applyTheme('dark', false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('tat class .dark khi theme light', () => {
    applyTheme('dark', false)
    applyTheme('light', true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('system → theo prefersDark', () => {
    applyTheme('system', true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    applyTheme('system', false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('applyFontScale', () => {
  beforeEach(() => {
    resetHtml()
  })

  it('set --font-scale', () => {
    applyFontScale(1.2)
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.2')
  })

  it('fallback 1 cho gia tri ngoai danh sach', () => {
    applyFontScale(2)
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1')
  })
})

describe('applyDensity', () => {
  beforeEach(() => {
    resetHtml()
  })

  it('set --density-scale', () => {
    applyDensity('compact')
    expect(document.documentElement.style.getPropertyValue('--density-scale')).toBe('0.85')
  })
})

describe('applyPanelWidth', () => {
  beforeEach(() => {
    resetHtml()
  })

  it('set --panel-max-width', () => {
    applyPanelWidth('wide')
    expect(document.documentElement.style.getPropertyValue('--panel-max-width')).toBe('960px')
  })
})

describe('prefersDarkScheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('tra ve false khi khong co matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersDarkScheme()).toBe(false)
  })

  it('tra ve matches cua media query', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    expect(prefersDarkScheme()).toBe(true)
  })
})

describe('watchSystemTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('goi callback khi nen toi OS doi', () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = []
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener)
      },
      removeEventListener: vi.fn(),
    }))

    const onChange = vi.fn()
    const stop = watchSystemTheme(onChange)
    expect(listeners).toHaveLength(1)

    listeners[0]?.({ matches: true } as MediaQueryListEvent)
    expect(onChange).toHaveBeenCalledWith(true)

    stop()
  })

  it('tra ve noop khi khong co matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    const stop = watchSystemTheme(vi.fn())
    expect(() => {
      stop()
    }).not.toThrow()
  })
})
