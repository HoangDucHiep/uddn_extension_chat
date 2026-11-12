import { describe, expect, it } from 'vitest'
import { loadDataset } from '../src/dataset.js'
import { buildTaskAttachments } from '../src/runners/ours.js'

/**
 * Test runner dinh kem **anh** cho task nhom `vision` (T-M2-12 / T-M2-14).
 *
 * Bug (phat hien khi chay eval that): `buildTaskAttachments()` resolve asset
 * tu `resolve(APP_ROOT, '..', '..', asset.path)` → tro ra **ngoai** monorepo
 * (`D:\apps\eval\...`) → `readFile` that bai → **bo qua** asset → anh
 * **khong** duoc gui cho provider → model tra loi "toi khong the xem anh".
 *
 * Ha fix: resolve tu repo root (`resolve(REPO_ROOT, asset.path)`).
 */

describe('runner — dinh kem anh (nhom vision)', () => {
  it('task vision co it nhat 1 anh duoc dinh kem that (data khong rong)', async () => {
    const tasks = await loadDataset()
    const vision = tasks.filter((task) => task.group === 'vision')
    expect(vision.length).toBeGreaterThanOrEqual(4)

    for (const task of vision) {
      const attachments = await buildTaskAttachments(task)
      const expected = (task.assets ?? []).filter((asset) => asset.kind === 'image').length

      expect(attachments.length).toBe(expected)
    }
  })

  it('anh dinh kem co du lieu base64 hop le + kich thuoc khop dataset', async () => {
    const tasks = await loadDataset()
    const withAssets = tasks.filter((task) => (task.assets?.length ?? 0) > 0)
    expect(withAssets.length).toBeGreaterThanOrEqual(4)

    for (const task of withAssets) {
      const attachments = await buildTaskAttachments(task)
      const images = (task.assets ?? []).filter((asset) => asset.kind === 'image')

      for (const [index, image] of images.entries()) {
        const attachment = attachments[index]
        expect(attachment).toBeDefined()
        if (attachment === undefined) continue

        // Base64 hop le → decode lai ra byte goc.
        const decoded = Buffer.from(attachment.data, 'base64')
        expect(decoded.byteLength).toBe(image.bytes)
        expect(attachment.bytes).toBe(image.bytes)
        expect(attachment.mimeType).toBe(image.mime_type)
        expect(attachment.id).toMatch(/^[0-9a-f-]{36}$/i)
      }
    }
  })

  it('task khong co asset → khong dinh kem gi', async () => {
    const tasks = await loadDataset()
    const withoutAssets = tasks.filter((task) => (task.assets?.length ?? 0) === 0)
    expect(withoutAssets.length).toBeGreaterThan(0)

    for (const task of withoutAssets) {
      expect(await buildTaskAttachments(task)).toHaveLength(0)
    }
  })
})
