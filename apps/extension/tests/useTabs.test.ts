import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const listOpenTabsMock = vi.fn()

vi.mock('@/lib/tabList', () => ({
  listOpenTabs: () => listOpenTabsMock(),
}))

const { useTabs } = await import('../src/sidepanel/hooks/useTabs')

/**
 * Unit test cho hook `useTabs` — nap danh sach tab cho popover `@` (T-M1-05).
 * Docs: docs/SYSTEM_DESIGN.md §7.3.3
 */

beforeEach(() => {
  listOpenTabsMock.mockReset()
  listOpenTabsMock.mockResolvedValue([])
})

describe('useTabs', () => {
  it('KHONG nap danh sach khi popover dong (lazy)', async () => {
    renderHook(() => useTabs(false))

    await waitFor(() => expect(listOpenTabsMock).not.toHaveBeenCalled())
  })

  it('nap danh sach khi popover mo', async () => {
    listOpenTabsMock.mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://a.com/', domain: 'a.com', favIconUrl: undefined, active: true },
    ])

    const { result } = renderHook(() => useTabs(true))

    await waitFor(() => expect(result.current.tabs).toHaveLength(1))
    expect(result.current.tabs[0]?.id).toBe(1)
    expect(result.current.isLoading).toBe(false)
  })

  it('bat trang thai loading khi dang nap', async () => {
    let resolve: (value: unknown) => void = () => undefined
    listOpenTabsMock.mockReturnValue(
      new Promise((res) => {
        resolve = res
      }),
    )

    const { result } = renderHook(() => useTabs(true))

    await waitFor(() => expect(result.current.isLoading).toBe(true))

    await act(async () => {
      resolve([])
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('reload nap lai danh sach', async () => {
    listOpenTabsMock.mockResolvedValue([])

    const { result } = renderHook(() => useTabs(true))
    await waitFor(() => expect(listOpenTabsMock).toHaveBeenCalledTimes(1))

    listOpenTabsMock.mockResolvedValue([
      { id: 9, title: 'Moi', url: 'https://b.com/', domain: 'b.com', favIconUrl: undefined, active: false },
    ])

    await act(async () => {
      await result.current.reload()
    })

    await waitFor(() => expect(result.current.tabs).toHaveLength(1))
    expect(result.current.tabs[0]?.id).toBe(9)
  })

  it('danh sach rong khi khong co tab nao', async () => {
    const { result } = renderHook(() => useTabs(true))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tabs).toEqual([])
  })
})
