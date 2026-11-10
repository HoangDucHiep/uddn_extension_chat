import { expect, type Page } from '@playwright/test'
import { test } from './fixtures.js'

/**
 * E2E: Skills — menu `/` + CRUD drawer (T-M2-04, FR-SKILL-01/02/03).
 *
 * Kiem chung:
 *  - (1) Go `/` → popover hien danh sach skill.
 *  - (2) Chon skill → token `/ten-skill` vao composer + `skillId` gui len BFF.
 *  - (3) Loc skill theo prefix.
 *  - (4) Mo drawer tu nut header → danh sach skill hien.
 *  - (5) Escape → dong popover.
 *
 * BFF duoc stub bang `page.route` → test chay doc lap.
 * Docs: docs/SYSTEM_DESIGN.md §7.25
 */

interface SkillFixture {
  id: string
  name: string
  description: string
  promptTemplate: string
  scope: 'user' | 'builtin'
  enabled: boolean
  tags: string[]
  model?: string
  createdAt: string
  updatedAt: string
}

interface CapturedChatRequest {
  messages?: Array<{ role?: string; content?: string }>
  skillId?: string
}

const SKILL_TOM_TAT: SkillFixture = {
  id: 'a1000000-0000-4000-8000-000000000001',
  name: 'tom-tat',
  description: 'Tóm tắt nội dung thành 5 ý chính',
  promptTemplate: 'Tóm tắt {input} thành 5 ý chính.',
  scope: 'builtin',
  enabled: true,
  tags: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

const SKILL_DICH: SkillFixture = {
  id: 'a1000000-0000-4000-8000-000000000003',
  name: 'dich',
  description: 'Dịch sang tiếng Việt',
  promptTemplate: 'Dịch sang tiếng Việt: {input}',
  scope: 'builtin',
  enabled: true,
  tags: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

/** SSE stream gia lap. */
const SSE_BODY = [
  'event: meta',
  'data: {"type":"meta","messageId":"msg-1","conversationId":"11111111-1111-4111-8111-111111111111","provider":"mock","model":"mock-model","keySource":"K1","requestId":"req-1"}',
  '',
  'event: token',
  'data: {"type":"token","delta":"Da nhan","index":0}',
  '',
  'event: done',
  'data: {"type":"done","finishReason":"stop","messageId":"msg-1"}',
  '',
  '',
].join('\n')

/** Stub `GET /api/skills` + `POST /api/chat`. */
async function stubApi(panel: Page): Promise<CapturedChatRequest[]> {
  const captured: CapturedChatRequest[] = []

  await panel.route('**/api/skills**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ items: [SKILL_TOM_TAT, SKILL_DICH] }),
    })
  })

  await panel.route('**/api/chat', async (route) => {
    const raw = route.request().postData()
    if (raw !== null) {
      captured.push(JSON.parse(raw) as CapturedChatRequest)
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: SSE_BODY,
    })
  })

  return captured
}

test('go / → popover hien danh sach skill', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubApi(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('/')

  const popover = panel.getByTestId('skill-popover')
  await expect(popover).toBeVisible({ timeout: 20_000 })
  await expect(panel.getByTestId('skill-option')).toHaveCount(2)
  await expect(popover).toContainText('tom-tat')
  await expect(popover).toContainText('dich')

  await panel.close()
})

test('loc skill theo prefix', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubApi(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('/tom')
  await panel.getByTestId('skill-popover').waitFor({ state: 'visible', timeout: 20_000 })

  await expect(panel.getByTestId('skill-option')).toHaveCount(1)
  await expect(panel.getByTestId('skill-popover')).not.toContainText('dich')

  await panel.close()
})

test('chon skill → token vao composer + request co skillId', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  const captured = await stubApi(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('/')
  await panel.getByTestId('skill-popover').waitFor({ state: 'visible', timeout: 20_000 })

  await panel.getByTestId('skill-option').first().click()

  // Token `/ten-skill` da duoc chen vao textarea.
  await expect(panel.getByTestId('composer-input')).toHaveValue(/\/tom-tat/)

  // Viet them cau hoi → gui.
  await panel.getByTestId('composer-input').fill('/tom-tat bai viet ve AI')
  await panel.getByTestId('composer-send').click()
  await expect(panel.getByTestId('message-user')).toBeVisible({ timeout: 20_000 })

  await expect.poll(() => captured.length, { timeout: 20_000 }).toBeGreaterThan(0)

  const request = captured[0]
  // Token `/tom-tat` bi loai khoi cau hoi gui len BFF.
  expect(request?.messages?.[0]?.content).toBe('bai viet ve AI')
  // Server resolve skill tu `skillId`.
  expect(request?.skillId).toBe(SKILL_TOM_TAT.id)

  await panel.close()
})

test('Escape → dong popover skill', async ({ context, extensionId }) => {
  const panel = await context.newPage()
  await stubApi(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('composer-input').fill('/')
  await panel.getByTestId('skill-popover').waitFor({ state: 'visible', timeout: 20_000 })

  await panel.getByTestId('composer-input').press('Escape')

  await expect(panel.getByTestId('skill-popover')).toHaveCount(0)

  await panel.close()
})

test('mo drawer skill tu nut header → danh sach skill hien', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await stubApi(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('skills-button').click()

  const manager = panel.getByTestId('skill-manager')
  await expect(manager).toBeVisible({ timeout: 20_000 })
  await expect(manager).toContainText('tom-tat')
  await expect(manager).toContainText('Có sẵn')

  await panel.close()
})

test('bam "Dung" skill trong drawer → token vao composer', async ({
  context,
  extensionId,
}) => {
  const panel = await context.newPage()
  await stubApi(panel)

  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await panel.getByTestId('skills-button').click()
  await panel.getByTestId('skill-manager').waitFor({ state: 'visible', timeout: 20_000 })

  await panel.getByTestId('skill-use').first().click()

  await expect(panel.getByTestId('composer-input')).toHaveValue(/\/tom-tat/)

  await panel.close()
})
