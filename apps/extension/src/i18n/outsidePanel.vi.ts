/**
 * Khoa dich "ngoai side panel" — **nguon su that** (tieng Viet).
 *
 * Chi 4 khoa: 2 cho content script (nút nổi) + 2 cho context menu của
 * service worker.
 *
 * ## Ly do tach rieng
 *
 * `vi.ts` (dictionary day du ~17 kB) la nguon su that cua **danh sach key**
 * cho side panel. Content script (`dist/content.js`) chi can 4 khoa → dung
 * chung dictionary day du lam bundle phinh tu 13.87 kB len ~46 kB.
 *
 * File nay la **ban rut gon** cho bundle ngoai panel; `vi.ts` **spread** file
 * nay nen khong ton tai 2 nguon su that.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */
export const outsidePanelViDictionary = {
  'content.selectionButton': 'Hỏi Sidekick',
  'content.selectionButtonLabel': '{label} về đoạn văn bản đã bôi đen',
  'background.menu.open': 'Mở Sidekick AI',
  'background.menu.askSelection': 'Hỏi Sidekick với đoạn đã chọn',
} as const

/** Dictionary "ngoai panel" — kieu de `outsidePanel.en.ts` rang buoc key. */
export type OutsidePanelDictionary = Record<
  keyof typeof outsidePanelViDictionary,
  string
>
