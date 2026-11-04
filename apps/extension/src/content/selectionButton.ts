/**
 * Nut nobi "Hoi Sidekick" — xuat hien canh vung text user boi den (T-M1-02).
 *
 * Dung **Shadow DOM** de CSS cua trang host khong ghi de style cua nut (va
 * nguoc lai). Shadow root `mode: 'open'` → Playwright/test van truy cap
 * duoc qua `host.shadowRoot`.
 *
 * Khong dung `lucide-react` o day: content script phai build o dang IIFE
 * 1 file nen kéo thu vien UI se lam bundle phinh to. Icon SVG viet tay.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.3.4, docs/DESIGN_SYSTEM_BRIEF.md §3.5
 */

import type { SelectionAnchor } from './selection.js'
import { buildSelectionButtonCss } from './selectionStyles.js'

/** Id cua host element trong trang web. */
export const SELECTION_BUTTON_HOST_ID = 'sidekick-selection-button'

/** Nhan cua nut (tieng Viet). */
const BUTTON_LABEL = 'Hoi Sidekick'

/** SVG path cua icon "sparkle" — viet tay de khong keo thu vien UI. */
const ICON_PATH =
  'M12 2.5l1.9 5.1a3 3 0 0 0 1.7 1.7l5.1 1.9-5.1 1.9a3 3 0 0 0-1.7 1.7L12 19.9l-1.9-5.1a3 3 0 0 0-1.7-1.7L3.3 11.2l5.1-1.9a3 3 0 0 0 1.7-1.7L12 2.5z'

/** Giao dien cua nut nobi. */
export interface SelectionButtonOptions {
  /** Callback khi nguoi dung click nut. */
  onSelect: () => void
  /** Document dung de gan host element (mac dinh `document`). */
  doc?: Document
}

/** Handle dieu khien nut nobi. */
export interface SelectionButtonHandle {
  /** Hien nut tai vi tri da tinh. */
  show: (anchor: SelectionAnchor) => void
  /** An nut. */
  hide: () => void
  /** Xoa host element khoi trang ( dung khi teardown). */
  destroy: () => void
}

/**
 * Tao nut nobi "Hoi Sidekick" trong trang web.
 *
 * - Host element co `position: fixed` → toa do viewport.
 * - Nut chi hien khi host co `data-visible="true"`.
 *
 * @param options - Callback + document dich.
 */
export function createSelectionButton(options: SelectionButtonOptions): SelectionButtonHandle {
  const doc = options.doc ?? document

  // Khong tao trung: neu host da ton tai (inject 2 lan) → dung lai.
  const existing = doc.getElementById(SELECTION_BUTTON_HOST_ID)
  if (existing !== null) {
    existing.remove()
  }

  const host = doc.createElement('div')
  host.id = SELECTION_BUTTON_HOST_ID
  host.setAttribute('data-visible', 'false')

  const shadow = host.attachShadow({ mode: 'open' })

  const style = doc.createElement('style')
  style.textContent = buildSelectionButtonCss()
  shadow.appendChild(style)

  const button = doc.createElement('button')
  button.type = 'button'
  button.setAttribute('data-testid', 'selection-affordance')
  button.setAttribute('aria-label', `${BUTTON_LABEL} về đoạn văn bản đã bôi đen`)

  // Icon + nhan tach biet (khong dung innerHTML de tranh injection).
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('fill', 'currentColor')
  path.setAttribute('d', ICON_PATH)
  svg.appendChild(path)

  const label = doc.createElement('span')
  label.textContent = BUTTON_LABEL

  button.appendChild(svg)
  button.appendChild(label)

  button.addEventListener('click', (event) => {
    // Khong de click chay xuong trang host (trang co the co handler chon text).
    event.preventDefault()
    event.stopPropagation()
    options.onSelect()
  })

  shadow.appendChild(button)
  doc.documentElement.appendChild(host)

  return {
    show: (anchor: SelectionAnchor): void => {
      host.style.left = `${anchor.left}px`
      host.style.top = `${anchor.top}px`
      host.setAttribute('data-visible', 'true')
    },
    hide: (): void => {
      host.setAttribute('data-visible', 'false')
    },
    destroy: (): void => {
      host.remove()
    },
  }
}
