import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Onboarding } from '../src/sidepanel/components/onboarding/Onboarding'

/**
 * Unit test cho man hinh onboarding 3 buoc (FR-UX-02 — T-M1-25).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.6, docs/DESIGN_SYSTEM_BRIEF.md §3.6
 */

/** Mock provider list tra tu `GET /api/providers`. */
const providersResponse = {
  items: [
    {
      id: 'mock',
      name: 'Mock Provider',
      models: ['mock-model'],
      keySource: 'none',
      requiresKey: false,
      available: true,
    },
    {
      id: 'groq',
      name: 'Groq',
      models: ['openai/gpt-oss-120b'],
      keySource: 'none',
      requiresKey: true,
      available: false,
    },
  ],
}

/** Mock SSE stream cho `POST /api/chat`. */
function stubStream(text: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const body = [
        `event: meta\ndata: ${JSON.stringify({
          type: 'meta',
          messageId: 'msg-1',
          conversationId: 'conv-1',
          provider: 'mock',
          model: 'mock-model',
          keySource: 'K1',
          requestId: 'req-1',
        })}\n\n`,
        `event: token\ndata: ${JSON.stringify({
          type: 'token',
          delta: text,
          index: 0,
        })}\n\n`,
        `event: done\ndata: ${JSON.stringify({
          type: 'done',
          finishReason: 'stop',
          messageId: 'msg-1',
        })}\n\n`,
      ].join('')

      return {
        ok: true,
        status: 200,
        body: {
          getReader() {
            let done = false
            return {
              async read() {
                if (done) return { done: true, value: undefined }
                done = true
                const encoder = new TextEncoder()
                return { done: false, value: encoder.encode(body) }
              },
              releaseLock() {},
            }
          },
        },
        text: async () => body,
      }
    }),
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(providersResponse),
    })),
  )
})

describe('Onboarding', () => {
  it('hien thi buoc 1 (giai thich quyen) mac dinh', () => {
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )

    expect(screen.getByTestId('onboarding')).toBeDefined()
    expect(screen.getByTestId('onboarding-step-permissions')).toBeDefined()
    expect(screen.getByText('Bước 1/3 · Quyền')).toBeDefined()
    expect(screen.getByText('sidePanel')).toBeDefined()
    expect(screen.getByText('<all_urls>')).toBeDefined()
  })

  it('buoc 1 → buoc 2 khi bam "Tiếp tục"', async () => {
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('onboarding-next'))

    expect(screen.getByTestId('onboarding-step-provider')).toBeDefined()
    expect(screen.getByText('Bước 2/3 · Mô hình AI')).toBeDefined()
  })

  it('buoc 2 tai danh sach provider tu API', async () => {
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))

    await waitFor(() => {
      expect(screen.getByText('Mock Provider')).toBeDefined()
    })
    expect(screen.getByText('Groq')).toBeDefined()
  })

  it('buoc 2 hien thi thong bao khi provider can key nhung chua co key', async () => {
    const onSelectProvider = vi.fn()
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={onSelectProvider}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-provider-groq')).toBeDefined()
    })

    // Chon provider can key → hien thong bao thieu key (khong con o nhap key).
    fireEvent.click(screen.getByTestId('onboarding-provider-groq'))

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-key-required')).toBeDefined()
    })
    expect(screen.queryByTestId('onboarding-api-key')).toBeNull()
    expect(onSelectProvider).toHaveBeenCalledWith('groq')
  })

  it('buoc 2 khong hien thi thong bao key voi provider khong can key', async () => {
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-provider-mock')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('onboarding-provider-mock'))

    expect(screen.queryByTestId('onboarding-key-required')).toBeNull()
    expect(screen.queryByTestId('onboarding-api-key')).toBeNull()
  })

  it('buoc 2 → buoc 3 khi bam "Tiếp tục"', async () => {
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-step-provider')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('onboarding-next'))

    expect(screen.getByTestId('onboarding-step-try')).toBeDefined()
    expect(screen.getByText('Bước 3/3 · Thử câu hỏi')).toBeDefined()
  })

  it('buoc 3 goi SSE that va hien thi cau tra loi', async () => {
    stubStream('Xin chao ban!')
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-step-provider')).toBeDefined()
    })
    fireEvent.click(screen.getByTestId('onboarding-next'))

    fireEvent.change(screen.getByTestId('onboarding-try-input'), {
      target: { value: 'Ban khoe the nao?' },
    })
    fireEvent.click(screen.getByTestId('onboarding-try-send'))

    await waitFor(() => {
      expect(screen.getByTestId('onboarding-try-answer')).toBeDefined()
    })
    expect(screen.getByText('Xin chao ban!')).toBeDefined()
  })

  it('bam "Bỏ qua" → goi onComplete (co completed = true)', () => {
    const onComplete = vi.fn()
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={onComplete}
      />,
    )

    fireEvent.click(screen.getByTestId('onboarding-skip'))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('bam "Hoan tat" o buoc 3 → goi onComplete', async () => {
    const onComplete = vi.fn()
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={onComplete}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-step-provider')).toBeDefined()
    })
    fireEvent.click(screen.getByTestId('onboarding-next'))

    fireEvent.click(screen.getByTestId('onboarding-complete'))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('nut "Quay lai" quay ve buoc truoc', async () => {
    render(
      <Onboarding
        preferredProvider={undefined}
        onSelectProvider={vi.fn()}
        onComplete={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('onboarding-next'))
    await waitFor(() => {
      expect(screen.getByTestId('onboarding-step-provider')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('onboarding-back'))

    expect(screen.getByTestId('onboarding-step-permissions')).toBeDefined()
  })
})
