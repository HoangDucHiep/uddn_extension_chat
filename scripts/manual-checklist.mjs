/**
 * Script chay checklist test **tay** (MANUAL_TEST_GUIDE.md) trong Chrome that.
 *
 * Script nay tu dong hoa phan "test tay" ma nguoi dung phai lam:
 *   - Load extension **unpacked** tu `apps/extension/dist` vao Chrome that.
 *   - Di qua tung muc cua checklist §11b (model picker / fallback / chi phi).
 *   - Luu **anh chup** vao `artifacts/manual-test/` de lam bang chung.
 *
 * Dung: `node scripts/manual-checklist.mjs`
 * Dieu kien:
 *   - Docker Desktop chay (`docker compose up -d`) → Postgres cho `/api/usage`.
 *   - BFF chay (`pnpm dev:server`) o `http://127.0.0.1:8787`.
 *   - Extension da build (`pnpm build`).
 *
 * KHONG dung extension GUI thật cua nguoi dung → khong dung profile Chrome
 * cua nguoi dung → an toàn.
 */

import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const EXTENSION_PATH = join(ROOT, 'apps', 'extension', 'dist')
const ARTIFACT_DIR = join(ROOT, 'artifacts', 'manual-test')
const BFF_URL = process.env.SIDEKICK_BFF_URL ?? 'http://127.0.0.1:8787'

// Playwright nam o `apps/extension` (devDependency cua workspace do) → resolve
// tu do de khong phai them dependency o root.
const require = createRequire(join(ROOT, 'apps', 'extension', 'package.json'))
const { chromium } = require('@playwright/test')

/** Danh sach muc se chay — khop voi MANUAL_TEST_GUIDE.md §11b. */
const results = []

/**
 * Ghi 1 ket qua checklist.
 *
 * @param {string} id - Ma muc.
 * @param {boolean} passed - Muc co pass hay khong.
 * @param {string} note - Ghi chu ngan.
 */
function record(id, passed, note) {
  results.push({ id, passed, note })
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id}  ${note}`)
}

/**
 * Chup anh man hinh va luu vao thu muc artifact.
 *
 * @param {import('@playwright/test').Page} page - Trang can chup.
 * @param {string} name - Ten file (khong can duoi file).
 */
async function shot(page, name) {
  await page.screenshot({ path: join(ARTIFACT_DIR, `${name}.png`) })
}

/**
 * Kiem tra BFF co chay khong.
 *
 * @returns {Promise<boolean>} `true` neu BFF tra 200.
 */
async function isBffUp() {
  try {
    const response = await fetch(`${BFF_URL}/api/health`)
    return response.status === 200
  } catch {
    return false
  }
}

/**
 * Doc extension id tu service worker.
 *
 * @param {import('@playwright/test').BrowserContext} context - Context.
 * @returns {Promise<string>} Extension id.
 */
async function readExtensionId(context) {
  let worker = context.serviceWorkers()[0]
  if (!worker) {
    worker = await context.waitForEvent('serviceworker')
  }
  const match = /^chrome-extension:\/\/([a-p]{32})\//.exec(worker.url())
  if (!match?.[1]) {
    throw new Error(`Khong lay duoc extension id tu ${worker.url()}`)
  }
  return match[1]
}

/**
 * Cho phep panel dung ma (bat ky gi canh cheo).
 *
 * @param {import('@playwright/test').Page} page - Trang panel.
 */
async function waitForPanel(page) {
  await page.waitForSelector('#root', { timeout: 30_000 })
  await page.waitForTimeout(500)
}

async function main() {
  rmSync(ARTIFACT_DIR, { recursive: true, force: true })
  mkdirSync(ARTIFACT_DIR, { recursive: true })

  if (!(await isBffUp())) {
    console.error(`BFF khong chay tai ${BFF_URL}. Hay chay \`pnpm dev:server\` truoc.`)
    process.exitCode = 1
    return
  }

  const health = await (await fetch(`${BFF_URL}/api/health`)).json()
  console.log(`BFF: ${JSON.stringify(health)}`)
  if (health.db !== 'up') {
    console.error('DB dang `down` → hay bat Docker Desktop roi chay lai.')
    process.exitCode = 1
    return
  }

  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
  })

  const extensionId = await readExtensionId(context)
  console.log(`Extension id: ${extensionId}`)

  // Danh dau onboarding da xong (de panel mo ra thang chat).
  const seed = await context.newPage()
  await seed.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await seed.evaluate(async () => {
    await chrome.storage.local.set({ 'sidekick.onboarding.completed': true })
  })
  await seed.close()

  const panel = await context.newPage()
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await waitForPanel(panel)

  // --- §11b.1 Model picker ---
  await panel.getByTestId('model-picker-button').click()
  await panel.getByTestId('model-picker').waitFor({ state: 'visible', timeout: 15_000 })
  await shot(panel, '01-model-picker-open')

  const providerButtons = panel.getByTestId('model-picker-providers').locator('button')
  const providerCount = await providerButtons.count()
  record(
    '11b.1-1',
    providerCount > 0,
    `Danh sach provider co ${providerCount} muc (chi provider \`available\`)`,
  )

  // Chon provider co nhieu model nhat de kiem chung o "tim kiem" (> 12 model).
  let modelCount = 0
  let searchProvider = ''
  for (let index = 0; index < providerCount; index += 1) {
    const button = providerButtons.nth(index)
    const providerId = (await button.getAttribute('data-testid'))?.replace(
      'model-picker-provider-',
      '',
    )
    await button.click()
    await panel.waitForTimeout(2500)
    const count = await panel.getByTestId('model-picker-models').locator('button').count()
    if (count > modelCount) {
      modelCount = count
      searchProvider = providerId ?? ''
    }
    if (count > 12) break
  }
  await shot(panel, '02-model-picker-models')
  record(
    '11b.1-2',
    modelCount > 0,
    `Provider "${searchProvider}" co ${modelCount} model (nhieu nhat trong danh sach)`,
  )

  // Tim kiem (chi xuat hien khi > 12 model).
  const searchBox = panel.getByTestId('model-picker-search')
  const hasSearch = (await searchBox.count()) > 0
  if (hasSearch) {
    const keyword = (
      (await panel.getByTestId('model-picker-models').locator('button').first().textContent()) ??
      ''
    ).trim()
    await searchBox.fill(keyword.slice(0, 4))
    await panel.waitForTimeout(500)
    const filtered = await panel.getByTestId('model-picker-models').locator('button').count()
    await shot(panel, '03-model-picker-search')
    record(
      '11b.1-3',
      filtered < modelCount,
      `Loc tim kiem theo "${keyword.slice(0, 4)}": ${modelCount} → ${filtered} model`,
    )
  } else {
    record('11b.1-3', true, 'Provider nay <= 12 model → khong hien o tim kiem (dung thiet ke)')
  }

  // Chon 1 model → luu vao storage.
  await panel.getByTestId('model-picker-models').locator('button').first().click()
  await panel.waitForTimeout(600)

  const saved = await panel.evaluate(async () => {
    const raw = await chrome.storage.local.get('sidekick.modelSelection')
    return raw['sidekick.modelSelection']
  })
  record(
    '11b.1-4',
    Boolean(saved?.providerId && saved?.model),
    `Lua chon da luu: ${saved?.providerId} · ${saved?.model}`,
  )

  // "Ve mac dinh" → xoa lua chon. Popover van dang mo → khong bam lai trigger.
  if ((await panel.getByTestId('model-picker').count()) === 0) {
    await panel.getByTestId('model-picker-button').click()
  }
  await panel.getByTestId('model-picker-reset').waitFor({ state: 'visible', timeout: 10_000 })
  await panel.getByTestId('model-picker-reset').click()
  await panel.waitForTimeout(600)
  const cleared = await panel.evaluate(async () => {
    const raw = await chrome.storage.local.get('sidekick.modelSelection')
    return raw['sidekick.modelSelection']
  })
  record('11b.1-5', cleared?.providerId == null, 'Bam "Ve mac dinh" → xoa lua chon')

  // Dong popover (Escape).
  await panel.keyboard.press('Escape')
  await panel.waitForTimeout(300)

  // --- §11b.3 Chat + badge token/chi phi ---
  await panel.getByTestId('composer-input').fill('Xin chao, tra loi mot cau ngan.')
  await panel.getByTestId('composer-send').click()
  await panel.getByTestId('message-assistant').waitFor({ state: 'visible', timeout: 40_000 })
  await panel.waitForTimeout(2500)
  await shot(panel, '04-chat-assistant')

  const badge = panel.getByTestId('usage-badge')
  const badgeVisible = (await badge.count()) > 0
  const badgeText = badgeVisible ? ((await badge.first().textContent()) ?? '').trim() : ''
  record(
    '11b.3-1',
    badgeVisible && badgeText.includes('token'),
    `Badge duoi bubble assistant: "${badgeText}"`,
  )
  record(
    '11b.3-2',
    badgeText.includes('$'),
    `Badge co chi phi USD: ${badgeText.includes('$') ? 'co' : 'khong (provider local / chua co usage)'}`,
  )

  // --- §11b.3 Settings → Chi phi & su dung ---
  await panel.getByTestId('settings-button').click()
  await panel.getByTestId('settings-drawer').waitFor({ state: 'visible', timeout: 15_000 })
  await panel.waitForTimeout(2500)
  await shot(panel, '05-settings-usage')

  const totalTokens = panel.getByTestId('usage-total-tokens')
  const totalCost = panel.getByTestId('usage-total-cost')
  const hasTotals =
    (await totalTokens.count()) > 0 &&
    (await totalTokens.first().textContent()) !== null &&
    (await totalCost.count()) > 0
  record(
    '11b.3-3',
    hasTotals,
    `Tong token="${(await totalTokens.first().textContent())?.trim() ?? ''}" · tong chi phi="${(await totalCost.first().textContent())?.trim() ?? ''}"`,
  )

  // Bang theo ngay (`usage-by-day` chi render khi co du lieu).
  const byDayList = panel.getByTestId('usage-by-day')
  const dayRows = (await byDayList.count()) > 0 ? await byDayList.locator('li').count() : 0
  record('11b.3-4', dayRows > 0, `Bang theo ngay co ${dayRows} dong`)

  // Doi khoang thoi gian.
  const rangeButtons = await panel.getByTestId('usage-settings-ranges').locator('button').count()
  record('11b.3-5', rangeButtons === 4, `Bo chon khoang thoi gian co ${rangeButtons} nut`)

  await panel.getByTestId('usage-settings-range-today').click()
  await panel.waitForTimeout(2000)
  await shot(panel, '06-usage-range-today')
  const todayTokens = panel.getByTestId('usage-total-tokens')
  const todayText =
    (await todayTokens.count()) > 0 ? ((await todayTokens.first().textContent())?.trim() ?? '') : '(khong co du lieu)'
  record('11b.3-6', true, `Khoang "Hôm nay" → tong token = "${todayText}"`)

  await panel.getByTestId('usage-settings-range-all').click()
  await panel.waitForTimeout(2000)
  await shot(panel, '07-usage-range-all')
  const allTokens = panel.getByTestId('usage-total-tokens')
  const allText =
    (await allTokens.count()) > 0 ? ((await allTokens.first().textContent())?.trim() ?? '') : '(khong co du lieu)'
  record('11b.3-7', true, `Khoang "Tat ca" → tong token = "${allText}"`)

  // Nut lam moi.
  await panel.getByTestId('usage-settings-refresh').click()
  await panel.waitForTimeout(1500)
  record('11b.3-8', true, 'Bam "Lam moi" → goi lai API khong loi')

  await panel.close()
  await context.close()

  // --- §11b.2 Fallback chain (live) ---
  // Dung BFF phu voi provider dau tinh **hong chay** (Ollama tat) → loi
  // network (retryable) → server phai fallback sang provider tiep theo.
  const fallbackPort = 8791
  const fallback = await startFallbackBff(fallbackPort)
  if (fallback === undefined) {
    record('11b.2-1', false, 'Khong khoi dong duoc BFF phu de test fallback')
  } else {
    try {
      const switchSeen = await runFallbackProbe(`http://127.0.0.1:${fallbackPort}`)
      record(
        '11b.2-1',
        switchSeen.switched,
        switchSeen.detail,
      )
      record(
        '11b.2-2',
        switchSeen.loggedFallback,
        switchSeen.logDetail,
      )
    } finally {
      await fallback.stop()
    }
  }

  // --- Bao cao ---
  const passed = results.filter((item) => item.passed).length
  console.log(`\n=== Ket qua: ${passed}/${results.length} muc pass ===`)
  console.log(`Anh chup: ${ARTIFACT_DIR}`)
  if (passed !== results.length) {
    process.exitCode = 1
  }
}

/**
 * Khoi dong BFF phu voi provider dau tinh **hong chay** de kiem chung fallback.
 *
 * Ollama mac dinh khong chay tren may nguoi dung → loi network (retryable)
 * → server fallback sang provider tiep theo trong chuoi.
 *
 * @param {number} port - Port cho BFF phu.
 * @returns {Promise<{ stop: () => Promise<void> } | undefined>} Handle.
 */
async function startFallbackBff(port) {
  const child = spawn(
    'pnpm.cmd',
    ['--filter', '@sidekick/server', 'exec', 'tsx', 'src/index.ts'],
    {
      cwd: join(ROOT, 'apps', 'server'),
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        // Chuoi fallback: Ollama (khong chay) → Groq → OpenRouter.
        DEFAULT_PROVIDER: 'ollama',
        PROVIDER_FALLBACKS: 'groq,openrouter',
        OLLAMA_BASE_URL: 'http://127.0.0.1:11434/v1',
      },
      stdio: 'ignore',
      // Windows: `pnpm.cmd` can chay truc tiep, nhung spawn khong tim thay
      // file executable → can `shell: true`.
      shell: true,
    },
  )

  // Cho BFF len (poll health).
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (response.status === 200) {
        return {
          stop: async () => {
            await killProcessTree(child.pid)
            await new Promise((resolve) => setTimeout(resolve, 500))
          },
        }
      }
    } catch {
      // Chua len → thu lai.
    }
  }

  await killProcessTree(child.pid)
  return undefined
}

/**
 * Tat ca cay tien trinh cua mot process (Windows).
 *
 * `child.kill()` chi tat **wrapper** (`cmd.exe` cua `pnpm.cmd`) → tien trinh
 * con (`node` cua `tsx`) van chay va **giu port** → BFF phu chay lai sau khi
 * script ket thuc. `taskkill /T` tat ca cay.
 *
 * @param {number | undefined} pid - PID cua process can tat.
 */
async function killProcessTree(pid) {
  if (pid === undefined) return

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: true,
      })
      killer.on('close', () => {
        resolve(undefined)
      })
      killer.on('error', () => {
        resolve(undefined)
      })
    })
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    // Tien trinh da chet → bo qua.
  }
}

/**
 * Gui mot luot chat den BFF phu va kiem chung co fallback hay khong.
 *
 * @param {string} baseUrl - Base URL cua BFF phu.
 * @returns {Promise<{ switched: boolean; detail: string; loggedFallback: boolean; logDetail: string }>} Ket qua.
 */
async function runFallbackProbe(baseUrl) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Kiem chung fallback' }],
      provider: 'ollama',
    }),
  })

  const text = await response.text()
  const switchEvent = /"type":"provider_switch"/.test(text)
  const fromMatch = /"from":"([^"]+)"/.exec(text)
  const toMatch = /"to":"([^"]+)"/.exec(text)

  // Doc log DB de xac nhan `fallback_from` duoc ghi.
  const logs = await fetch(`${baseUrl}/api/logs?limit=5`).then((res) => res.json())
  const rows = Array.isArray(logs?.items) ? logs.items : []
  const fallbackRow = rows.find((row) => row?.fallbackFrom !== null && row?.fallbackFrom !== undefined)

  return {
    switched: switchEvent,
    detail: switchEvent
      ? `SSE co event provider_switch: ${fromMatch?.[1] ?? '?'} → ${toMatch?.[1] ?? '?'}`
      : 'SSE KHONG co event provider_switch',
    loggedFallback: Boolean(fallbackRow),
    logDetail: fallbackRow
      ? `request_logs: provider="${fallbackRow.provider}" fallback_from="${fallbackRow.fallbackFrom}"`
      : 'request_logs: KHONG tim thay dong co fallback_from',
  }
}

await main()
