import { outsidePanelViDictionary } from './outsidePanel.vi.js'

/**
 * Nhom khoa "ngoai side panel" — content script + service worker.
 *
 * > **Nguon su that:** danh sach khoa duoc suy ra tu
 * > `outsidePanel.vi.ts` → khong the "forget" them khoa moi.
 *
 * @see outsidePanel.vi.ts — nguon su that cua **noi dung** chuoi dich.
 * @see outsidePanel.en.ts — ban tieng Anh (kieu rang buoc key).
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */
export const OUTSIDE_PANEL_KEYS = Object.keys(outsidePanelViDictionary).sort() as readonly (
  keyof typeof outsidePanelViDictionary
)[]

/** Union cua cac khoa "ngoai panel". */
export type OutsidePanelKey = keyof typeof outsidePanelViDictionary
