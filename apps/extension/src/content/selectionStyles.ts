/**
 * Sinh CSS cho nut nobi "Hoi Sidekick" trong shadow DOM (T-M1-02).
 *
 * Content script chay trong "isolated world" cua trang web → khong duoc
 * dung CSS cua extension (sidepanel) → phai tu inject style vao shadow root.
 *
 * Nguon su that mau sac: `design/tokens.json` (import JSON, khong hardcode
 * mau trong code). Tu sinh CSS string → dung duoc cho ca light va dark theme
 * qua `prefers-color-scheme`.
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.5, docs/SYSTEM_DESIGN.md §7.3.4
 */

import tokens from '../../../../design/tokens.json'

/** Cac token mau can dung cho nut nobi. */
const COLOR_KEYS = [
  'accent',
  'accent-fg',
  'surface-overlay',
  'border-default',
  'border-strong',
  'text-primary',
  'text-secondary',
] as const

type ColorKey = (typeof COLOR_KEYS)[number]

/** Lay gia tri mau cua mot key tu tokens.json. */
function colorOf(scheme: 'light' | 'dark', key: ColorKey): string {
  const schemeColors = tokens.color[scheme] as Record<ColorKey, string>
  return schemeColors[key]
}

/**
 * Tao block CSS cho mot scheme (light hoac dark).
 *
 * @param scheme - Scheme mau can sinh.
 */
function schemeBlock(scheme: 'light' | 'dark'): string {
  const declarations = COLOR_KEYS.map(
    (key) => `      --sk-${key}: ${colorOf(scheme, key)};`,
  ).join('\n')

  const shadow = tokens.elevation['shadow-2']
  const radius = tokens.radius.md
  const fontSize = tokens.typography['font-size-sm']
  const fontSans = tokens.typography['font-sans']

  return `    :host {
${declarations}
      --sk-shadow: ${shadow};
      --sk-radius: ${radius};
      --sk-font-size: ${fontSize};
      --sk-font-sans: ${fontSans};
    }`
}

/**
 * CSS cua nut nobi selection — nhung trong `<style>` cua shadow root.
 *
 * Dung `all: initial` tren host de trang host khong ghi de style cua nut.
 */
export function buildSelectionButtonCss(): string {
  return `
${schemeBlock('light')}

    :host {
      position: fixed;
      z-index: 2147483647;
      display: none;
      font-family: var(--sk-font-sans);
    }

    :host([data-visible='true']) {
      display: inline-flex;
    }

    button {
      all: initial;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: var(--sk-radius);
      border: 1px solid var(--sk-border-strong);
      background: var(--sk-surface-overlay);
      color: var(--sk-text-primary);
      font-family: var(--sk-font-sans);
      font-size: var(--sk-font-size);
      line-height: 1.4;
      cursor: pointer;
      box-shadow: var(--sk-shadow);
      white-space: nowrap;
    }

    button:hover {
      background: var(--sk-accent);
      border-color: var(--sk-accent);
      color: var(--sk-accent-fg);
    }

    button:focus-visible {
      outline: 2px solid var(--sk-accent);
      outline-offset: 2px;
    }

    button svg {
      width: 14px;
      height: 14px;
      flex: none;
    }

    @media (prefers-color-scheme: dark) {
${schemeBlock('dark')}
    }
`
}
