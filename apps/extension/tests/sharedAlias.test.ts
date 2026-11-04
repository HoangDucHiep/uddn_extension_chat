import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/**
 * Guard hạ tầng test: `@sidekick/shared` phải resolve tới **source**
 * (`packages/shared/src`), KHÔNG phải bản build trong `packages/shared/dist`.
 *
 * Vì sao cần guard này?
 * - `packages/shared/dist` bị `.gitignore` → fresh clone không có sẵn.
 * - Nếu test resolve tới `dist`, sửa `packages/shared/src` mà quên build
 *   → test chạy trên CODE CŨ và vẫn xanh → test pass nhưng code sai.
 * - Đây chính là loại "test xanh nhưng sai" mà guard này chặn lại.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const VITEST_CONFIG_PATH = resolve(HERE, '..', 'vitest.config.ts')

/**
 * Doc noi dung file alias trong vitest config — tránh phụ thuoc `vite` config
 * loader (nhanh hon, khong can spawn process).
 */
function readVitestConfig(): string {
  return readFileSync(VITEST_CONFIG_PATH, 'utf8')
}

describe('guard: vitest resolve @sidekick/shared tu source', () => {
  it('vitest.config.ts tro alias @sidekick/shared ve packages/shared/src', () => {
    const config = readVitestConfig()

    expect(config).toContain('packages/shared/src')
    expect(config).toMatch(/SHARED_SRC\s*=\s*resolve\(/)
  })

  it('alias dung cho ca @sidekick/shared va @sidekick/shared/constants', () => {
    const config = readVitestConfig()

    // Subpath phai khai bao TRUOC alias chung, neu khong se bi che.
    const constantsIndex = config.indexOf('@sidekick\\/shared\\/constants')
    const sharedIndex = config.indexOf('@sidekick\\/shared$')

    expect(constantsIndex).toBeGreaterThan(-1)
    expect(sharedIndex).toBeGreaterThan(-1)
    expect(constantsIndex).toBeLessThan(sharedIndex)
  })
})

describe('guard: @sidekick/shared resolve dung file source', () => {
  it('import @sidekick/shared se ra source chu khong phai dist', async () => {
    // Module resolve cua vitest — dung chinh alias dang chay.
    const shared = await import('@sidekick/shared')
    expect(shared.CHARS_PER_TOKEN).toBe(4)

    // Neu alias bi xoa, `@sidekick/shared` se tro ve
    // `packages/shared/dist/index.js` → khac instance module.
    // Neu alias con, ca hai cung tro ve MOT file source → identical.
    const sourceModule = await import('../../../packages/shared/src/constants.js')
    expect(sourceModule.LIMITS).toBe(shared.LIMITS)
    expect(sourceModule.MAX_CONTEXT_ITEMS).toBe(shared.MAX_CONTEXT_ITEMS)
  })
})
