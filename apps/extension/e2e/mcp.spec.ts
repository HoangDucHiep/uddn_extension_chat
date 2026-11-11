import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: quan ly MCP server trong Settings (FR-TOOLS-01 — T-M2-08).
 *
 * Kiem chung:
 *  - (1) Section "MCP server" xuat hien trong drawer Settings.
 *  - (2) Danh sach server rong → thong bao rong.
 *  - (3) Them MCP server → API duoc goi voi body dung cau hinh.
 *  - (4) Server dang ket noi → hien ten + badge trang thai + so tool.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap, khong can server that.
 * Docs: docs/SYSTEM_DESIGN.md §7.27
 */

/** Server MCP gia lap. */
const SERVER = {
  id: 'srv-1',
  name: 'sample',
  transport: 'stdio',
  command: 'node',
  args: ['scripts/sample-mcp-server.mjs'],
  env: {},
  enabled: true,
  autoApprove: false,
  status: 'connected',
  toolCount: 2,
}

/** Body POST /api/mcp/servers da ghi nhan. */
const createdBodies: Array<Record<string, unknown>> = []

/**
 * Stub endpoint MCP.
 *
 * @param panel - Page cua side panel.
 * @param options - Cau hinh stub.
 * @param options.items - Danh sach server tra ve.
 */
async function stubMcp(
  panel: Page,
  options: { items?: Array<Record<string, unknown>> } = {},
): Promise<void> {
  const items = options.items ?? []

  await panel.route('**/api/mcp/servers', async (route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      createdBodies.push(JSON.parse(request.postData() ?? '{}') as Record<string, unknown>)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(SERVER),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items }),
    })
  })

  await panel.route('**/api/mcp/tools', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: [] }),
    })
  })
}

/**
 * Mo drawer Settings.
 *
 * @param panel - Page cua side panel.
 */
async function openSettings(panel: Page): Promise<void> {
  await panel.getByTestId('settings-button').click()
  await expect(panel.getByTestId('settings-drawer')).toBeVisible({ timeout: 20_000 })
}

test.beforeEach(() => {
  createdBodies.length = 0
})

test('section MCP server xuat hien trong drawer Settings', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubMcp(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await expect(
    panel.getByRole('heading', { name: 'MCP server' }),
  ).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('mcp-settings-empty')).toBeVisible()
  await expect(panel.getByTestId('mcp-settings-add')).toBeVisible()

  await panel.close()
})

test('khong co MCP server → hien thong bao rong', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubMcp(panel, { items: [] })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await expect(panel.getByTestId('mcp-settings-empty')).toBeVisible({ timeout: 20_000 })

  await panel.close()
})

test('them MCP server → goi API voi cau hinh dung', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubMcp(panel, { items: [] })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await panel.getByTestId('mcp-settings-add').click()
  await expect(panel.getByTestId('mcp-form-name')).toBeVisible({ timeout: 20_000 })

  await panel.getByTestId('mcp-form-name').fill('sample')
  await panel.getByTestId('mcp-form-command').fill('node')
  await panel.getByTestId('mcp-form-args').fill('scripts/sample-mcp-server.mjs')
  await panel.getByTestId('mcp-form-submit').click()

  await expect.poll(() => createdBodies.length, { timeout: 20_000 }).toBeGreaterThan(0)
  const payload = createdBodies[0]
  expect(payload?.['name']).toBe('sample')
  expect(payload?.['command']).toBe('node')
  expect(payload?.['args']).toEqual(['scripts/sample-mcp-server.mjs'])
  expect(payload?.['transport']).toBe('stdio')

  await panel.close()
})

test('MCP server da ket noi → hien ten + so tool', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubMcp(panel, { items: [SERVER] })

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await openSettings(panel)

  await expect(panel.getByTestId('mcp-server-item')).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('mcp-server-name')).toContainText('sample')
  await expect(panel.getByTestId('mcp-server-meta')).toContainText('2')

  await panel.close()
})
