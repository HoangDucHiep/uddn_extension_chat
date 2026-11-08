/**
 * Khoa dich "ngoai side panel" — tieng Anh.
 *
 * Kieu `OutsidePanelDictionary` → **thieu key se loi `pnpm typecheck`**.
 *
 * Docs: docs/SYSTEM_DESIGN.md §7.17
 */
import type { OutsidePanelDictionary } from './outsidePanel.vi.js'

/** Dictionary tieng Anh cho khoa "ngoai panel". */
export const outsidePanelEnDictionary: OutsidePanelDictionary = {
  'content.selectionButton': 'Ask Sidekick',
  'content.selectionButtonLabel': '{label} about the selected text',
  'background.menu.open': 'Open Sidekick AI',
  'background.menu.askSelection': 'Ask Sidekick about the selected text',
}
