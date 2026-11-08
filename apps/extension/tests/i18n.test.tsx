import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { createTranslator, formatMessage, getDictionary, resolveLanguage } from '../src/i18n'
import { viDictionary } from '../src/i18n/vi'
import { enDictionary } from '../src/i18n/en'
import { readUiLanguage, translatorFor } from '../src/lib/i18n'
import { SETTINGS_STORAGE_KEY } from '../src/lib/settings'
import { useI18n } from '../src/sidepanel/hooks/useI18n'

/**
 * Unit test cho module i18n (FR-SETTINGS-06 — T-M1-17).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */

/** Regex nhung ky tu co dau tieng Viet — dung cho dictionary English. */
const VIETNAMESE_DIACRITICS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i

/**
 * Key duoc phep giu dau tieng Viet.
 *
 * Ten ngon ngu luon viet theo cach bo danh ("Tiếng Việt") → khong "sai".
 */
const ALLOWED_VIETNAMESE_KEYS = new Set(['settings.language.vi'])

describe('i18n dictionaries', () => {
  it('en.ts va vi.ts co cung tap key', () => {
    const viKeys = Object.keys(viDictionary).sort()
    const enKeys = Object.keys(enDictionary).sort()
    expect(enKeys).toEqual(viKeys)
  })

  it('khong co gia tri rong trong 2 dictionary', () => {
    for (const [key, value] of Object.entries(viDictionary)) {
      expect(value, `vi: ${key}`).not.toBe('')
    }
    for (const [key, value] of Object.entries(enDictionary)) {
      expect(value, `en: ${key}`).not.toBe('')
    }
  })

  it('dictionary English khong chua dau tieng Viet', () => {
    for (const [key, value] of Object.entries(enDictionary)) {
      if (ALLOWED_VIETNAMESE_KEYS.has(key)) continue
      expect(VIETNAMESE_DIACRITICS.test(value), `en: ${key} → ${value}`).toBe(false)
    }
  })

  it('mo key deu dung placeholder giong nhau', () => {
    const placeholdersOf = (template: string): string[] =>
      [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()

    for (const key of Object.keys(viDictionary) as (keyof typeof viDictionary)[]) {
      const vi = viDictionary[key]
      const en = enDictionary[key]
      expect(placeholdersOf(en), `key: ${key}`).toEqual(placeholdersOf(vi))
    }
  })
})

describe('getDictionary', () => {
  it('tra dictionary dung theo ngon ngu', () => {
    expect(getDictionary('vi')).toBe(viDictionary)
    expect(getDictionary('en')).toBe(enDictionary)
  })

  it('fallback sang tieng Viet khi ngon ngu khong hop le', () => {
    // Ngon ngu sai kieu → `DICTIONARIES[language]` undefined → fallback VI.
    expect(getDictionary('fr' as never)).toBe(viDictionary)
  })
})

describe('resolveLanguage', () => {
  it('chuan hoa gia tri hop le', () => {
    expect(resolveLanguage('vi')).toBe('vi')
    expect(resolveLanguage('en')).toBe('en')
  })

  it('tra undefined khi gia tri khong hop le', () => {
    expect(resolveLanguage('fr')).toBeUndefined()
    expect(resolveLanguage(undefined)).toBeUndefined()
    expect(resolveLanguage(42)).toBeUndefined()
  })
})

describe('formatMessage', () => {
  it('thay the placeholder', () => {
    expect(formatMessage('Xin chao {name}!', { name: 'Ban' })).toBe('Xin chao Ban!')
  })

  it('thay the nhieu placeholder', () => {
    expect(formatMessage('{a} va {b}', { a: '1', b: '2' })).toBe('1 va 2')
  })

  it('giu nguyen placeholder khong co gia tri', () => {
    expect(formatMessage('Xin chao {name}!', {})).toBe('Xin chao {name}!')
  })

  it('khong doi chuoi khi khong co params', () => {
    expect(formatMessage('Xin chao {name}!')).toBe('Xin chao {name}!')
  })
})

describe('createTranslator', () => {
  it('dich theo ngon ngu', () => {
    const tVi = createTranslator('vi')
    const tEn = createTranslator('en')
    expect(tVi('common.cancel')).toBe('Huỷ')
    expect(tEn('common.cancel')).toBe('Cancel')
  })

  it('thay the placeholder qua translator', () => {
    const t = createTranslator('en')
    expect(t('conversation.deleteDescription', { title: 'Demo' })).toContain('Demo')
  })

  it('tra ve chinh key khi key khong ton tai (bien)', () => {
    const t = createTranslator('en')
    expect(t('khong.co.key' as never)).toBe('khong.co.key')
  })
})

describe('readUiLanguage', () => {
  beforeEach(async () => {
    const all = await chrome.storage.local.get(null)
    await chrome.storage.local.remove(Object.keys(all))
  })

  it('mac dinh la tieng Viet khi storage rong', async () => {
    await expect(readUiLanguage()).resolves.toBe('vi')
  })

  it('doc ngon ngu tu settings', async () => {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: { uiLanguage: 'en' },
    })
    await expect(readUiLanguage()).resolves.toBe('en')
  })

  it('fallback ve tieng Viet khi settings hong', async () => {
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: { uiLanguage: 'fr' },
    })
    await expect(readUiLanguage()).resolves.toBe('vi')
  })
})

describe('translatorFor', () => {
  it('tao translator dong bo theo ngon ngu', () => {
    expect(translatorFor('en')('common.delete')).toBe('Delete')
  })
})

describe('useI18n', () => {
  /** Component test giu nguyen `t` va `language` ra ngoai de assert. */
  function Probe(): JSX.Element {
    const { t, language } = useI18n()
    return (
      <div>
        <span data-testid="lang">{language}</span>
        <span data-testid="text">{t('common.cancel')}</span>
      </div>
    )
  }

  it('mac dinh dung tieng Viet khi khong boc provider', () => {
    render(<Probe />)
    expect(screen.getByTestId('lang').textContent).toBe('vi')
    expect(screen.getByTestId('text').textContent).toBe('Huỷ')
  })
})
