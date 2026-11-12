import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessageActions } from '../src/sidepanel/components/chat/MessageActions'
import { MessageEditBox } from '../src/sidepanel/components/chat/MessageEditBox'
import { ScrollToBottomButton } from '../src/sidepanel/components/chat/ScrollToBottomButton'
import type { TurnMessage } from '../src/lib/chatTurns'

/**
 * Unit test cho UI thao tac chat (T-M1-10).
 *
 * Docs: docs/DESIGN_SYSTEM_BRIEF.md §3.3
 */

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

describe('MessageActions', () => {
  it('assistant: hien nut "Tao lai"', () => {
    const onRegenerate = vi.fn()
    render(
      <MessageActions
        message={message({ id: 'a1' })}
        variants={[]}
        activeVariant={undefined}
        onRegenerate={onRegenerate}
      />,
    )

    fireEvent.click(screen.getByTestId('message-regenerate-button'))
    expect(onRegenerate).toHaveBeenCalledWith('a1')
  })

  it('assistant: hien nut "Tiep tuc" khi message bi aborted', () => {
    const onContinue = vi.fn()
    render(
      <MessageActions
        message={message({ id: 'a1', aborted: true })}
        variants={[]}
        activeVariant={undefined}
        onContinue={onContinue}
      />,
    )

    fireEvent.click(screen.getByTestId('message-continue-button'))
    expect(onContinue).toHaveBeenCalledWith('a1')
  })

  it('assistant: khong hien nut "Tiep tuc" khi khong bi aborted', () => {
    render(
      <MessageActions
        message={message({ id: 'a1' })}
        variants={[]}
        activeVariant={undefined}
        onContinue={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('message-continue-button')).toBeNull()
  })

  it('user: hien nut "Sua" va goi handler', () => {
    const onEdit = vi.fn()
    render(
      <MessageActions
        message={message({ id: 'u1', role: 'user' })}
        variants={[]}
        activeVariant={undefined}
        onEdit={onEdit}
      />,
    )

    fireEvent.click(screen.getByTestId('message-edit-button'))
    expect(onEdit).toHaveBeenCalledWith('u1')
  })

  it('hien switcher bien the "1/2" khi turn co > 1 bien the', () => {
    const variants = [
      message({ id: 'a0', turnId: 't1', variantIndex: 0, active: true }),
      message({ id: 'a1', turnId: 't1', variantIndex: 1, active: false }),
    ]

    render(
      <MessageActions
        message={variants[0] as TurnMessage}
        variants={variants}
        activeVariant={variants[0]}
        onSelectVariant={vi.fn()}
      />,
    )

    expect(screen.getByTestId('message-variant-trigger').textContent).toBe('1/2')
  })

  it('khong hien switcher khi chi co 1 bien the', () => {
    const variants = [message({ id: 'a0', turnId: 't1', variantIndex: 0, active: true })]

    render(
      <MessageActions
        message={variants[0] as TurnMessage}
        variants={variants}
        activeVariant={variants[0]}
        onSelectVariant={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('message-variant-trigger')).toBeNull()
  })

  it('an thao tac khi dang streaming', () => {
    render(
      <MessageActions
        message={message({ id: 'a1' })}
        variants={[]}
        activeVariant={undefined}
        onRegenerate={vi.fn()}
        isStreaming
      />,
    )

    expect(
      (screen.getByTestId('message-regenerate-button') as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

describe('MessageEditBox', () => {
  it('hien noi dung ban dau', () => {
    render(
      <MessageEditBox initialContent="cau hoi cu" onSubmit={vi.fn()} onCancel={vi.fn()} />,
    )

    expect(
      (screen.getByTestId('message-edit-input') as HTMLTextAreaElement).value,
    ).toBe('cau hoi cu')
  })

  it('bam "Gui lai" → goi onSubmit voi noi dung da trim', () => {
    const onSubmit = vi.fn()
    render(
      <MessageEditBox
        initialContent="  cau hoi moi  "
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('message-edit-submit'))
    expect(onSubmit).toHaveBeenCalledWith('cau hoi moi')
  })

  it('bam "Huy" → goi onCancel', () => {
    const onCancel = vi.fn()
    render(
      <MessageEditBox initialContent="x" onSubmit={vi.fn()} onCancel={onCancel} />,
    )

    fireEvent.click(screen.getByTestId('message-edit-cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('Enter → gui', () => {
    const onSubmit = vi.fn()
    render(
      <MessageEditBox initialContent="cau" onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    fireEvent.keyDown(screen.getByTestId('message-edit-input'), {
      key: 'Enter',
      shiftKey: false,
    })
    expect(onSubmit).toHaveBeenCalledWith('cau')
  })

  it('Shift+Enter → xuong dong (khong gui)', () => {
    const onSubmit = vi.fn()
    render(
      <MessageEditBox initialContent="cau" onSubmit={onSubmit} onCancel={vi.fn()} />,
    )

    fireEvent.keyDown(screen.getByTestId('message-edit-input'), {
      key: 'Enter',
      shiftKey: true,
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Escape → huy', () => {
    const onCancel = vi.fn()
    render(
      <MessageEditBox initialContent="x" onSubmit={vi.fn()} onCancel={onCancel} />,
    )

    fireEvent.keyDown(screen.getByTestId('message-edit-input'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('ScrollToBottomButton', () => {
  it('goi handler khi bam', () => {
    const onScrollToBottom = vi.fn()
    render(<ScrollToBottomButton onScrollToBottom={onScrollToBottom} />)

    fireEvent.click(screen.getByTestId('scroll-to-bottom'))
    expect(onScrollToBottom).toHaveBeenCalled()
  })

  it('co aria-label tieng Viet', () => {
    render(<ScrollToBottomButton onScrollToBottom={vi.fn()} />)

    expect(screen.getByLabelText('Cuộn xuống cuối hội thoại')).toBeTruthy()
  })
})
