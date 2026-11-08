/**
 * Tai file xuống máy từ side panel (FR-CHAT-10 — T-M1-13).
 *
 * Tách riêng khỏi `lib/export.ts` để phần **sinh nội dung** giữ được
 * tính thuần (test được không cần DOM).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.20
 */

/**
 * Tao va trigger tai file text.
 *
 * Dùng `Blob` + `URL.createObjectURL` + thẻ `<a download>` — cách duy
 * nhất hoạt động trong side panel MV3 (không có `chrome.downloads` cần
 * thêm permission).
 *
 * @param fileName - Ten file (da sanitize).
 * @param content - Noi dung file.
 * @param mimeType - Kieu MIME cua file.
 */
export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
