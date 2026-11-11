import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ChatToolCall } from '../src/sidepanel/store/chatStore'

const { ToolCallBlock } = await import('../src/sidepanel/components/tools/ToolCallBlock')

/**
 * Unit test cho `ToolCallBlock` (FR-TOOLS-02/04 — T-M2-09).
 *
 * Kiem chung: hien ten/args/output · trang thai loi · badge "can duyet" +
 * nut duyet / tu choi.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.26.9
 */

const approveToolCall = vi.fn()
const denyToolCall = vi.fn()

vi.mock('../src/lib/toolClient', () => ({
  listTools: vi.fn(),
  approveToolCall: (id: string) => approveToolCall(id),
  denyToolCall: (id: string) => denyToolCall(id),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

/** Tao tool call gia lap. */
function toolCall(overrides: Partial<ChatToolCall> = {}): ChatToolCall {
  return {
    id: 'call-1',
    name: 'calculator',
    args: { expression: '2+2' },
    ...overrides,
  }
}

describe('ToolCallBlock', () => {
  it('hien ten tool + badge trang thai', () => {
    render(<ToolCallBlock toolCall={toolCall({ status: 'ok', output: '4' })} />)

    expect(screen.getByTestId('tool-call-block')).toBeTruthy()
    expect(screen.getByTestId('tool-call-toggle').textContent).toContain('calculator')
    expect(screen.getByTestId('tool-call-status').textContent).toContain('Xong')
  })

  it('mac dinh thu gon → chua hien args/output', () => {
    render(<ToolCallBlock toolCall={toolCall({ status: 'ok', output: '4' })} />)

    expect(screen.queryByTestId('tool-call-args')).toBeNull()
    expect(screen.queryByTestId('tool-call-output')).toBeNull()
  })

  it('mo rong → hien args (JSON pretty) + output', () => {
    render(<ToolCallBlock toolCall={toolCall({ status: 'ok', output: '4' })} />)

    fireEvent.click(screen.getByTestId('tool-call-toggle'))

    expect(screen.getByTestId('tool-call-args').textContent).toContain('"expression"')
    expect(screen.getByTestId('tool-call-output').textContent).toBe('4')
  })

  it('trang thai loi → badge "Loi"', () => {
    render(<ToolCallBlock toolCall={toolCall({ status: 'error', ok: false, output: 'boom' })} />)

    expect(screen.getByTestId('tool-call-status').textContent).toContain('Lỗi')
    expect(screen.getByTestId('tool-call-block').getAttribute('data-tool-status')).toBe('error')
  })

  it('tool can duyet → badge + nut Duyet / Tu choi', () => {
    render(
      <ToolCallBlock toolCall={toolCall({ approvalRequired: true, status: 'pending' })} />,
    )

    fireEvent.click(screen.getByTestId('tool-call-toggle'))

    expect(screen.getByTestId('tool-call-approval-badge')).toBeTruthy()
    expect(screen.getByTestId('tool-call-approve')).toBeTruthy()
    expect(screen.getByTestId('tool-call-deny')).toBeTruthy()
  })

  it('bam Duyet → goi API approve + cap nhat state', async () => {
    approveToolCall.mockResolvedValue({ id: 'call-1', approvedByUser: true })
    const onUpdate = vi.fn()

    render(
      <ToolCallBlock
        toolCall={toolCall({ approvalRequired: true, status: 'pending' })}
        onUpdate={onUpdate}
      />,
    )
    fireEvent.click(screen.getByTestId('tool-call-toggle'))
    fireEvent.click(screen.getByTestId('tool-call-approve'))

    await waitFor(() => {
      expect(approveToolCall).toHaveBeenCalledWith('call-1')
    })
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('call-1', expect.objectContaining({
        approvedByUser: true,
      }))
    })
  })

  it('bam Tu choi → goi API deny + cap nhat state', async () => {
    denyToolCall.mockResolvedValue({ id: 'call-1', approvedByUser: false })
    const onUpdate = vi.fn()

    render(
      <ToolCallBlock
        toolCall={toolCall({ approvalRequired: true, status: 'pending' })}
        onUpdate={onUpdate}
      />,
    )
    fireEvent.click(screen.getByTestId('tool-call-toggle'))
    fireEvent.click(screen.getByTestId('tool-call-deny'))

    await waitFor(() => {
      expect(denyToolCall).toHaveBeenCalledWith('call-1')
    })
    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('call-1', expect.objectContaining({
        deniedByUser: true,
      }))
    })
  })

  it('tool da duyet → khong hien nut duyet nua', () => {
    render(
      <ToolCallBlock
        toolCall={toolCall({ approvalRequired: true, approvedByUser: true, status: 'ok' })}
      />,
    )
    fireEvent.click(screen.getByTestId('tool-call-toggle'))

    expect(screen.queryByTestId('tool-call-approval-badge')).toBeNull()
    expect(screen.queryByTestId('tool-call-approve')).toBeNull()
  })

  it('tool bi tu choi → badge "Da tu choi"', () => {
    render(
      <ToolCallBlock
        toolCall={toolCall({ approvalRequired: true, deniedByUser: true, status: 'denied' })}
      />,
    )

    expect(screen.getByTestId('tool-call-status').textContent).toContain('Đã từ chối')
  })
})
