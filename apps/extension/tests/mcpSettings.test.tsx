import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { McpServer } from '@sidekick/shared'

const listMcpServersMock = vi.fn()
const createMcpServerMock = vi.fn()
const deleteMcpServerMock = vi.fn()
const reconnectMcpServerMock = vi.fn()

vi.mock('@/lib/mcpClient', () => ({
  listMcpServers: (...args: unknown[]) => listMcpServersMock(...args),
  createMcpServer: (...args: unknown[]) => createMcpServerMock(...args),
  deleteMcpServer: (...args: unknown[]) => deleteMcpServerMock(...args),
  reconnectMcpServer: (...args: unknown[]) => reconnectMcpServerMock(...args),
  updateMcpServer: vi.fn(),
  listMcpTools: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

const { McpSettings } = await import('../src/sidepanel/components/settings/McpSettings')

/**
 * Unit test cho section "MCP server" (T-M2-08 — FR-TOOLS-01).
 *
 * Kiem chung: danh sach server · them server · ket noi lai · xoa (co confirm) ·
 * loi API chi hien inline, KHONG crash drawer.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.27
 */

/** Tao MCP server gia lap. */
function server(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: 'srv-1',
    name: 'sample',
    transport: 'stdio',
    command: 'node',
    args: [],
    env: {},
    enabled: true,
    autoApprove: false,
    status: 'connected',
    toolCount: 2,
    ...overrides,
  }
}

beforeEach(() => {
  listMcpServersMock.mockReset()
  createMcpServerMock.mockReset()
  deleteMcpServerMock.mockReset()
  reconnectMcpServerMock.mockReset()
})

describe('McpSettings — danh sach', () => {
  it('hien danh sach MCP server', async () => {
    listMcpServersMock.mockResolvedValue({ items: [server()] })

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-server-item')).toBeTruthy()
    })
    expect(screen.getByTestId('mcp-server-name').textContent).toContain('sample')
  })

  it('khong co server → hien thong bao rong', async () => {
    listMcpServersMock.mockResolvedValue({ items: [] })

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-settings-empty')).toBeTruthy()
    })
  })

  it('server loi ket noi → hien loi + badge error', async () => {
    listMcpServersMock.mockResolvedValue({
      items: [server({ status: 'error', lastError: 'Khong khoi dong duoc MCP server' })],
    })

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-server-error').textContent).toContain(
        'Khong khoi dong duoc MCP server',
      )
    })
  })

  it('API that → hien loi inline, khong crash', async () => {
    listMcpServersMock.mockRejectedValue(new Error('boom'))

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-settings-error')).toBeTruthy()
    })
  })
})

describe('McpSettings — them server', () => {
  it('mo form → nhap → submit goi API', async () => {
    listMcpServersMock.mockResolvedValue({ items: [] })
    createMcpServerMock.mockResolvedValue(server())

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-settings-add')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('mcp-settings-add'))

    fireEvent.change(screen.getByTestId('mcp-form-name'), { target: { value: 'sample' } })
    fireEvent.change(screen.getByTestId('mcp-form-command'), { target: { value: 'npx' } })
    fireEvent.change(screen.getByTestId('mcp-form-args'), {
      target: { value: '-y\nserver' },
    })
    fireEvent.change(screen.getByTestId('mcp-form-env'), {
      target: { value: 'KEY=value' },
    })

    fireEvent.click(screen.getByTestId('mcp-form-submit'))

    await waitFor(() => {
      expect(createMcpServerMock).toHaveBeenCalled()
    })
    expect(createMcpServerMock.mock.calls[0]?.[0]).toMatchObject({
      name: 'sample',
      command: 'npx',
      args: ['-y', 'server'],
      env: { KEY: 'value' },
      autoApprove: false,
    })
  })

  it('ten rong → khong goi API', async () => {
    listMcpServersMock.mockResolvedValue({ items: [] })

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-settings-add')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('mcp-settings-add'))
    fireEvent.change(screen.getByTestId('mcp-form-command'), { target: { value: 'npx' } })
    fireEvent.click(screen.getByTestId('mcp-form-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('mcp-settings-error')).toBeTruthy()
    })
    expect(createMcpServerMock).not.toHaveBeenCalled()
  })
})

describe('McpSettings — ket noi lai', () => {
  it('bam "Ket noi lai" → goi API reconnect', async () => {
    listMcpServersMock.mockResolvedValue({ items: [server()] })
    reconnectMcpServerMock.mockResolvedValue({ id: 'srv-1', status: 'connected', toolCount: 2 })

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-server-reconnect')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('mcp-server-reconnect'))

    await waitFor(() => {
      expect(reconnectMcpServerMock).toHaveBeenCalledWith('srv-1')
    })
  })
})

describe('McpSettings — xoa server', () => {
  it('bam "Xoa" → confirm → goi API xoa', async () => {
    listMcpServersMock.mockResolvedValue({ items: [server()] })
    deleteMcpServerMock.mockResolvedValue(undefined)

    render(<McpSettings />)

    await waitFor(() => {
      expect(screen.getByTestId('mcp-server-remove')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('mcp-server-remove'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toBeTruthy()
    })

    fireEvent.click(screen.getByTestId('confirm-accept'))

    await waitFor(() => {
      expect(deleteMcpServerMock).toHaveBeenCalledWith('srv-1')
    })
  })
})
