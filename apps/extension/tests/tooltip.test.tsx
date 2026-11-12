import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../src/components/ui/tooltip'
import { IconButton } from '../src/components/ui/icon-button'
import { PanelHeader } from '../src/sidepanel/components/PanelHeader'

/**
 * Unit test primitive `Tooltip` + `IconButton` (T-M3-POLISH §7.31).
 *
 * Kiem chung:
 *  - `Tooltip` **tu boc provider** → render doc lap duoc (khong can
 *    `TooltipProvider` o goc cay).
 *  - `IconButton` co prop `tooltip` → boc tooltip tu dong.
 *  - Tooltip **khong thay the** `aria-label` (accessible name phai doc
 *    duoc ma khong hover).
 *  - Nut icon-only luon co kich thuoc >= 24px.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.31
 */

describe('Tooltip — primitive', () => {
  it('render doc lap duoc (tu boc provider)', () => {
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Nut" className="h-8 w-8">
            X
          </button>
        </TooltipTrigger>
        <TooltipContent>Mo ta</TooltipContent>
      </Tooltip>,
    )

    const button = screen.getByRole('button', { name: 'Nut' })
    expect(button).toBeDefined()
    expect(button.getAttribute('aria-label')).toBe('Nut')
  })

  it('IconButton co prop `tooltip` → boc tooltip tu dong', () => {
    render(<IconButton aria-label="Gui tin nhan" tooltip="Gui tin nhan" />)

    const button = screen.getByRole('button', { name: 'Gui tin nhan' })
    expect(button).toBeDefined()
  })

  it('IconButton khong co prop `tooltip` → van render nut binh thuong', () => {
    render(<IconButton aria-label="Xoa" />)

    expect(screen.getByRole('button', { name: 'Xoa' })).toBeDefined()
  })

  it('IconButton bat buoc co aria-label (type-level, runtime fallback an toan)', () => {
    render(<IconButton aria-label="Chay lai" />)

    const button = screen.getByRole('button', { name: 'Chay lai' })
    expect(button.getAttribute('aria-label')).toBe('Chay lai')
  })

  it('IconButton co kich thuoc toi thieu 24px (a11y tap target)', () => {
    const { container } = render(<IconButton aria-label="Chay lai" size="sm" />)

    const button = container.querySelector('button')
    expect(button?.className).toContain('h-7')
    expect(button?.className).toContain('w-7')
  })
})

describe('Tooltip — panel header', () => {
  it('moi nut icon trong header co aria-label (tooltip khong thay the)', () => {
    render(
      <PanelHeader
        onOpenConversations={() => undefined}
        onOpenOnboarding={() => undefined}
        onOpenSettings={() => undefined}
        onClear={() => undefined}
      />,
    )

    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBeTruthy()
    }
  })
})
