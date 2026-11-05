# Design System Brief — Sidekick AI

**Version:** v1.0 · **Ngày:** 2026-11-03 · **Trạng thái:** Baseline cho giai đoạn thiết kế UI
**Stack UI đã chốt:** Tailwind CSS + shadcn/ui (Radix primitives) + React 18 + TypeScript
**Nguồn yêu cầu:** [`REQUIREMENTS.md`](REQUIREMENTS.md) (§4.8 FR-SETTINGS, §4.9 FR-UX, §5.4 a11y, §5.1 hiệu năng)

> Tài liệu này **chốt ràng buộc thiết kế**, không vẽ giao diện. Mọi quyết định ở đây đều truy được về một requirement cụ thể, để thiết kế sau này không vỡ và để eval đo được.

---

## 1. Design principles

| # | Nguyên tắc | Hệ quả thiết kế bắt buộc |
|---|---|---|
| DP-1 | **Panel-first** | Mọi component thiết kế cho bề rộng 320–640px, cao 100vh. Không dựa vào layout desktop. Mọi container dùng `min-w-0` + `truncate` |
| DP-2 | **Chat-centric** | 1 màn hình chính (thread) chiếm ≥ 90% không gian. Mọi thứ khác là overlay/sheet/drawer |
| DP-3 | **Context luôn nhìn thấy** | Chip trạng thái context là **UI bắt buộc**, không phải tuỳ chọn. Đây là điểm phân biệt R7 (privacy transparency) trong eval |
| DP-4 | **Streaming-first** | Component chịu được nội dung tăng dần. Không layout shift giật. Không re-mount cây React khi nhận token |
| DP-5 | **Progressive disclosure** | Cấu hình nâng cao (MCP, RAG, model, key) ẩn sau Settings. Luồng chat chính không bị nhiễu |
| DP-6 | **Trust by transparency** | Luôn hiển thị: model đang dùng, token đã tiêu, nguồn trích dẫn, trạng thái mạng, nguồn API key. Không giấu gì |
| DP-7 | **Keyboard-first** | Mọi thao tác chính có phím tắt. Focus luôn rõ và nhìn thấy. Không có bẫy focus |

---

## 2. Design tokens

Nguồn sự thật: `design/tokens.json` → generate ra `design/tokens.css` (CSS variables). **Không hardcode màu trong component** — luôn dùng `var(--...)` hoặc class Tailwind map tới token.

**Cách nối vào extension (đã implement):**

- `apps/extension/src/sidepanel/index.css` import `design/tokens.css` **sau** `@import 'tailwindcss'` để token ghi đè mặc định của Tailwind (vd `--font-sans`).
- **KHÔNG** khai báo lại token trong `@theme inline` với `var(--token)` — sẽ tạo vòng lặp tự tham chiếu làm token rỗng.
- Typography đặt trên **`#root`** (div), không phải `body`: Chrome inject rule `font` cho `body` ở trang extension, đè lên `font-family`/`font-size` của design token.
- Component dùng class Tailwind arbitrary value: `bg-[var(--surface-panel)]`, `text-[var(--text-primary)]`, `h-[var(--header-height)]`.

### 2.1 Color

| Nhóm | Token | Ghi chú |
|---|---|---|
| Accent | `--color-accent`, `--color-accent-hover`, `--color-accent-subtle`, `--color-accent-fg` | Một màu nhấn duy nhất cho toàn sản phẩm |
| Surface | `--surface-panel`, `--surface-raised`, `--surface-sunken`, `--surface-overlay` | 4 cấp độ sâu, quy ước: panel < raised < overlay; sunken cho code block |
| Border | `--border-default`, `--border-strong`, `--border-subtle`, `--border-focus` | `--border-focus` là token riêng (WCAG) |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse` | Tương phản ≥ 4.5:1 (≥ 3:1 cho text lớn) |
| Semantic | `--success`, `--success-subtle`, `--warning`, `--warning-subtle`, `--danger`, `--danger-subtle`, `--info`, `--info-subtle` | Mỗi màu có 2 biến thể: solid + subtle (nền) |
| Citation | `--citation-bg`, `--citation-border`, `--citation-link`, `--citation-hover` | Màu riêng cho trích dẫn → nhận diện được ngay |
| Code | `--code-bg`, `--code-border`, `--code-fg`, `--code-token-keyword/-string/-number/-comment/-function/-punctuation` | Token cho syntax highlight |
| Focus | `--focus-ring`, `--focus-ring-offset` | ≥ 2px, offset ≥ 2px, luôn hiển thị |

**Ba theme:** `light`, `dark`, `system`. Theme `system` theo dõi `prefers-color-scheme` và chuyển đổi tức thì qua CSS `color-scheme` + class trên `<html>`.

### 2.2 Typography

| Token | Giá trị gợi ý | Dùng cho |
|---|---|---|
| `--font-sans` | `Inter, ui-sans-serif, system-ui, sans-serif` | UI, nội dung chat |
| `--font-mono` | `JetBrains Mono, ui-monospace, SFMono-Regular, monospace` | Code block |
| `--font-size-xs` | 11px | Badge, meta, timestamp |
| `--font-size-sm` | 12px | Chip, phụ đề |
| `--font-size-md` | 13px | **Mặc định** — body chat, composer |
| `--font-size-lg` | 15px | Tin nhắn user, heading |
| `--font-size-xl` | 18px | Heading h1/h2 trong nội dung markdown |
| `--line-height-tight` | 1.3 | Headings, code |
| `--line-height-base` | 1.5 | Body |
| `--line-height-relaxed` | 1.7 | Nội dung dài, đọc dễ |
| `--font-weight-regular/-medium/-semibold` | 400 / 500 / 600 | |

**Bắt buộc:** user đổi cỡ chữ (FR-SETTINGS-02) → dùng `rem` + biến `--font-scale` (1.0 / 1.125 / 1.25). Mọi kích thước text tính từ `--font-scale` **không** hardcode px.

### 2.3 Spacing, shape, elevation

| Nhóm | Token |
|---|---|
| Spacing | `--space-1` … `--space-8` theo base 4px (4, 8, 12, 16, 20, 24, 32, 40) |
| Radius | `--radius-sm` 4px, `--radius-md` 6px, `--radius-lg` 10px, `--radius-full` 9999px |
| Elevation | `--shadow-1` (card), `--shadow-2` (popover), `--shadow-3` (dialog). Dark theme dùng **viền** thay vì đổ bóng |
| Border width | `--border-width-hairline` 1px, `--border-width-normal` 1px, `--border-width-strong` 2px |

### 2.4 Motion

| Token | Giá trị |
|---|---|
| `--duration-fast` | 120ms |
| `--duration-base` | 200ms |
| `--duration-slow` | 320ms |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--ease-in-out` | `ease-in-out` |

**Bắt buộc (FR-UX-10):** `@media (prefers-reduced-motion: reduce)` → đặt tất cả `--duration-*` về `0ms` và tắt animation. Không được dùng animation để truyền tải thông tin duy nhất.

### 2.5 Layout

| Token | Giá trị | Ghi chú |
|---|---|---|
| `--panel-min-width` | 320px | FR-UX-06 |
| `--panel-max-width` | 640px | FR-UX-06 |
| `--header-height` | 48px | |
| `--composer-min-height` | 48px | |
| `--composer-max-height` | 240px | Auto-grow, scroll trong composer |
| `--gutter` | 12px (compact) / 16px (default) | Mật độ hiển thị (FR-SETTINGS-02) |
| `--message-max-width` | 100% | Chat full-width, không giống ChatGPT |

---

## 3. Component inventory

### 3.1 Chiến lược dùng lại vs tự viết

| Nhu cầu | Dùng lại | Tự viết |
|---|---|---|
| Button, IconButton, Input, Textarea | `shadcn/ui/button`, `input`, `textarea` | — |
| Popover (context chip, citation) | `shadcn/ui/popover` (Radix Popover) | — |
| Dialog (confirm xoá, settings) | `shadcn/ui/dialog` (Radix Dialog) | — |
| Tooltip | `shadcn/ui/tooltip` (Radix Tooltip) | — |
| Tabs (settings sections) | `shadcn/ui/tabs` (Radix Tabs) | — |
| Dropdown menu (model picker) | `shadcn/ui/dropdown-menu` (Radix) | — |
| Toast | `sonner` | — |
| Switch, Select, Slider, Label | `shadcn/ui/*` | — |
| Skeleton | `shadcn/ui/skeleton` | — |
| ScrollArea | `shadcn/ui/scroll-area` (Radix) | — |
| Markdown render | — | `MessageContent` (react-markdown + remark-gfm + rehype-sanitize) |
| Code block + highlight | — | `CodeBlock` (shiki, highlight tĩnh) |
| Bảng markdown | — | `MarkdownTable` |
| Citation chip + popover | — | `CitationChip`, `CitationPopover` |
| Mention popover (`@`) | — | `MentionPopover` |
| Skill menu (`/`) | — | `SkillMenu` |
| Context chips | — | `ContextChips` |
| Composer | — | `Composer` |
| Tool call block | — | `ToolCallBlock` |
| Conversation list drawer | — | `ConversationList` |
| Prompt gallery | — | `PromptGallery` |
| Onboarding | — | `Onboarding` |
| Workflow editor | — | `WorkflowEditor` (M4) |

**Quy tắc:** shadcn/ui được **copy code vào repo** (`apps/extension/src/components/ui/`), không cài từ npm → sở hữu 100%, không phụ thuộc runtime, tự sửa được.

### 3.2 Layout & Shell

| Component | Mô tả | FR liên quan | Rủi ro nếu thiết kế sai |
|---|---|---|---|
| `AppShell` | Khung: header / thread / composer, quản lý chiều rộng panel | FR-UX-06 | Vỡ layout ở 320px |
| `PanelHeader` | Tên app, chip model, chip context, menu điều hướng | FR-PROVIDER-03, FR-CONTEXT-02 | Không hiện nguồn key → vi phạm DP-6 |
| `ConversationList` | Drawer trái: danh sách chat, search, pin | FR-CHAT-09 | |
| `SettingsPanel` | Route/modal, chia section theo nhóm FR | FR-SETTINGS-* | |
| `StatusBadge` | Chip trạng thái: online / offline / BFF down / quota | NFR-REL-03/04 | |

### 3.3 Thread

| Component | Mô tả | FR liên quan | Rủi ro nếu thiết kế sai |
|---|---|---|---|
| `MessageList` | Virtualize, auto-scroll, nút "cuộn xuống" | FR-UX-05 | Jank khi response dài |
| `UserMessage` | Bubble, edit / copy / delete / branch | FR-CHAT-06, FR-CHAT-08 | |
| `AssistantMessage` | Render markdown + actions row | FR-CHAT-02 | |
| `MessageActions` | Copy, regenerate, thumbs up/down | FR-CHAT-05 | |
| `CodeBlock` | Highlight, copy, ngôn ngữ, expand | FR-CHAT-03 | Ảnh hưởng rubric R6 |
| `MarkdownTable` | Bảng, scroll ngang | FR-CHAT-04 | Vỡ layout ở panel hẹp |
| `CitationChip` | `[1]` chip → popover xem đoạn nguồn | FR-CONTEXT-10 | **Ảnh hưởng trực tiếp metric `citation_precision` trong eval** |
| `CitationPopover` | Preview đoạn nguồn + mở tab gốc | FR-CONTEXT-10 | |
| `ToolCallBlock` | Collapsible: tên tool, args, kết quả | FR-TOOLS-02, FR-TOOLS-06 | Ảnh hưởng `tool_success_rate` |
| `StreamingIndicator` | Con trỏ, shimmer, "Đang suy nghĩ" | FR-CHAT-01 | |
| `ErrorMessage` | Lỗi + hành động khôi phục | FR-CHAT-14 | Ảnh hưởng độ ổn định đo được |
| `AttachmentChip` | Ảnh đính kèm trong message | FR-VISION-01 | |
| `UsageBadge` | Token in/out + cost của lượt đó | FR-PROVIDER-05 | |

### 3.4 Composer

| Component | Mô tả | FR liên quan | Rủi ro nếu thiết kế sai |
|---|---|---|---|
| `Composer` | Ô nhập auto-grow, send/stop | FR-CHAT-12, FR-CHAT-13 | Ảnh hưởng rubric R4 |
| `ContextChips` | Chip tab đang share, bỏ được từng cái | FR-CONTEXT-02 | **Vi phạm quyền riêng tư → mất điểm NFR-SEC-02** |
| `ContextBudget` | Hiện "đã dùng X/Y token" + cảnh báo khi sắp vượt | FR-CONTEXT-07 | Người dùng không biết vì sao context bị cắt |
| `MentionPopover` | `@` → chọn tab | FR-CONTEXT-03 | Điểm parity so với Chrome Gemini |
| `SkillMenu` | `/` → chọn skill | FR-SKILL-01 | Điểm parity so với Chrome Gemini |
| `AttachmentTray` | Ảnh chờ gửi | FR-VISION-01 | |
| `ProviderBadge` | Chip provider/model + nguồn key đang dùng | FR-PROVIDER-09 | |
| `ContextNotice` | Banner lỗi trích xuất context (PDF scan, không có caption, không tải được file) — nằm ngay trên Composer, có nút đóng | FR-CONTEXT-05, FR-CONTEXT-06 | Người dùng tưởng chatbot bị hỏng → mất niềm tin |

#### `ContextChips` (đã implement T-M1-23 — hấp thụ T-M1-04)

- **Vị trí:** ngay trên `Composer`, dưới `ContextNotice`, trên `ContextBudget`. Chiếm 1 hàng, `flex-wrap`.
- **Nội dung:** chip toggle `role="switch"` ("Context") · chip từng item đã đính kèm · nút "Thêm trang này".
- **Mô hình (T-M1-23):** context **không** tự động — chỉ những gì user chủ động đính kèm mới có chip. Toggle mặc định **TẮT**; đính kèm item sẽ tự bật toggle (user vừa yêu cầu dùng context) nhưng vẫn tắt được bằng tay.
- **Icon theo `kind`:** `MousePointer` (selection) · `Globe` (tab) · `FileText` (file) — `lucide-react`.
- **Nút xoá chip:** `aria-label` tiếng Việt (`"Xoá context {title}"`), icon `X`.
- **Token:** `--border-default` (viền) · `--surface-raised` (nền chip) · `--surface-panel` (nền hàng) · `--text-secondary` (nhãn) · `--text-tertiary` (icon xoá) · `--color-accent` + `--color-accent-subtle` (toggle đang bật) · `--font-size-xs` · `--radius-full`.
- **A11y:** toggle dùng `role="switch"` + `aria-checked`; mọi nút có `aria-label` tiếng Việt; focus ring `--focus-ring`; không dùng màu là tín hiệu duy nhất (toggle có cả chữ "Context" + chấm tròn).

#### `ContextBudget` (đã implement T-M1-23)

- **Vị trí:** ngay dưới hàng `ContextChips`, trên `Composer`. Chỉ render khi **có** context item.
- **Hiển thị:** "Đã dùng 1.2k / 8k token" (rút gọn `k`, < 1000 hiện số thẳng) · dòng phụ "N nguồn bị cắt khỏi context" khi có item bị loại hẳn · "Một số nguồn bị rút gọn" khi có item bị cắt một phần.
- **Ngưỡng màu:** `< 70%` → `--success` / `--success-subtle` · `70–90%` → `--warning` / `--warning-subtle` · `> 90%` → `--danger` / `--danger-subtle`.
- **Token:** `--success` · `--warning` · `--danger` (+ biến thể `*-subtle`) · `--text-tertiary` (dòng phụ) · `--font-size-xs`.
- **A11y:** `role="status"` + `aria-live="polite"`; trạng thái có **icon + chữ** (không chỉ màu — WCAG 2.2 §5.1.3).
- **Lưu ý:** số token là **ước lượng** (`ceil(chars/4)`) → UI ghi "Đã dùng", không ghi "chính xác". Số token thật hiển thị ở `UsageBadge` (T-M2-03).

#### `AttachmentTray` (đã implement T-M1-24)

- **Vị trí:** ngay trên `Composer`, dưới `ContextBudget`. Render trong wrapper của Composer (nằm trong vùng drag-drop của Composer → thả file vào đâu cũng được).
- **Nội dung:** mỗi ảnh chờ gửi → 1 thumbnail 56×56 (`object-cover`, `rounded-[--radius-md]`) · nút ✕ ở góc trên phải để xoá từng ảnh · dòng phụ "N ảnh · ~M token" (ước lượng 258 token/ảnh).
- **Lỗi:** dòng `role="alert"` màu `--danger` phía trên danh sách thumbnail — thông báo tiếng Việt (sai định dạng / quá 5 MB / quá 4 ảnh / tổng quá 12 MB).
- **Token:** `--surface-panel` (nền hàng) · `--surface-raised` (nền thumbnail) · `--border-default` (viền) · `--surface-overlay` (nền nút ✕) · `--text-tertiary` (icon ✕) · `--danger` (lỗi) · `--font-size-xs` (dòng phụ) · `--radius-md` · `--radius-sm`.
- **A11y:** nút ✕ có `aria-label` tiếng Việt (`"Xoá ảnh đính kèm {tên file}"`) · thumbnail có `title` (tên file + kích thước) · focus ring `--focus-ring` · lỗi dùng `role="alert"`.
- **Không render** khi không có ảnh và không có lỗi → panel giữ gọn.

#### `AttachmentTray` — ảnh trong message (đã implement T-M1-24)

- Ảnh đã gửi hiển thị trong `MessageBubble` (message của user) → `<img>` với `max-h-[160px]`, `object-cover`, viền `--border-default`.
- Bấm ảnh → mở tab mới (`chrome.tabs.create`) với data URL → xem ảnh kích thước đầy đủ.
- `aria-label` tiếng Việt (`"Mở ảnh {tên file}"`) trên nút bọc ảnh.

#### `Composer` — nút đính kèm ảnh (đã implement T-M1-24)

- Nút icon `ImagePlus` (biểu tượng `lucide-react`) đặt **bên trái** nút gửi, cạnh textarea.
- Đi kèm `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple>` **ẩn** (`.hidden`) — nhấn nút → `ref.current.click()`.
- Trạng thái đang đọc file → icon `Loader2` xoay, nút disabled.
- `aria-label="Đính kèm ảnh"` (tiếng Việt).
- Nút **không** render khi không có handler ảnh (giữ component tái sử dụng được cho context khác).

#### `ContextNotice` (đã implement T-M1-21/T-M1-22)

- Vị trí: giữa thread và Composer. Token dùng: `--warning-subtle` (nền) · `--warning` (icon) · `--text-secondary` (nội dung) · `--border-default` (đường kẻ) · `--font-size-sm`. Icon `lucide-react`: `FileWarning` (lỗi PDF) · `AlertTriangle` (lỗi chung) · `X` (đóng). A11y: `role="status"` + `aria-live="polite"` · nút đóng có `aria-label` (tiếng Việt) · focus ring theo `--focus-ring`. Không tự động ẩn (người dùng tự đóng).

#### `MentionPopover` (đã implement T-M1-05)

- **Vị trí:** **overlay nổi** (`absolute bottom-full`) bám lên trên ô nhập trong `Composer` — không chiếm layout, không đẩy thread.
- **Kích hoạt:** gõ `@` trong `Composer` → `useMention.sync()` phát hiện token `@` → popover mở. `Escape` → đóng.
- **Nội dung mỗi dòng:** favicon (hoặc icon `Globe` khi trang không có favicon) · **title** · **domain** (dòng phụ) · dấu `Check` khi tab đã đính kèm · gạch dọc `--color-accent` khi tab đang active.
- **Trạng thái:** đang tải → icon `Loader2` + chữ "Đang tải danh sách tab..." · danh sách rỗng → chữ "Không có tab nào để đính kèm."
- **Token:** `--surface-overlay` (nền) · `--border-default` (viền) · `--shadow-2` (đổ bóng) · `--text-primary` (title) · `--text-tertiary` (domain) · `--color-accent` (dấu ✓ / gạch active) · `--surface-sunken` (hover) · `--font-size-sm` · `--font-size-xs` · `--radius-md` · `--radius-sm`.
- **A11y:** `role="listbox"` + `aria-label="Chọn tab để đính kèm"` · mỗi dòng `role="option"` + `aria-selected` (true khi đã đính kèm) · icon trạng thái có `aria-label` tiếng Việt · focus ring `--focus-ring`.
- **Không hardcode màu** — toàn bộ dùng design token như các chip khác.

### 3.5 Selection affordance (đã implement T-M1-02)

Component `SelectionAffordance` — nút nổi "Hỏi Sidekick" xuất hiện cạnh vùng text user bôi đen **trong trang web** (không phải trong panel).

- **Vị trí:** **overlay nổi** trong trang — `position: fixed`, neo theo bounding box của vùng chọn (ưu tiên **dưới** vùng chọn; tran cạnh dưới viewport → **trên**; toạ độ luôn clamp trong viewport).
- **Cô lập CSS:** nút nằm trong `attachShadow({ mode: 'open' })` → CSS của trang host **không** ghi đè được style của nút (và ngược lại).
- **Token:** CSS cho shadow root được **sinh tự động** từ `design/tokens.json` (`apps/extension/src/content/selectionStyles.ts`) → `--color-accent` · `--color-accent-fg` · `--surface-overlay` · `--border-strong` · `--text-primary` · `--text-secondary` · `--shadow-2` · `--radius-md` · `--font-size-sm` · `--font-sans`. Có biến thể `prefers-color-scheme: dark` để khớp theme hệ điều hành. **Không hardcode màu.**
- **A11y:** `<button type="button">` với `aria-label="Hỏi Sidekick về đoạn văn bản đã bôi đen"` (tiếng Việt) · icon SVG `aria-hidden="true"` · focus ring `--focus-ring` rõ ràng · `prefers-reduced-motion` không có animation nào để vi phạm.
- **Điều kiện hiện:** chỉ hiện khi vùng chọn ≥ `LIMITS.MIN_SELECTION_CHARS` (10 ký tự) → không gây phiền khi user chỉ click chuột. Ẩn ngay khi selection bị thu hồi hoặc trang scroll.
- **Đóng góp bundle:** content script build IIFE 1 file → **không** dùng `lucide-react` ở đây (kéo theo cả thư viện UI) → icon SVG viết tay.

Nút tương ứng trong panel: `ContextChips` → nút "Dính đoạn đã chọn" (icon `MousePointer2`, `data-testid="context-add-selection"`).

### 3.6 Overlays & feedback

| Component | Mô tả |
|---|---|
| `Toast` (sonner) | Thông báo không chặn nội dung |
| `ConfirmDialog` | Xoá / hành động phá huỷ |
| `PromptGallery` | Prompt gợi ý theo ngữ cảnh trang |
| `Onboarding` | 3 bước lần đầu: quyền → chọn provider → thử câu hỏi |
| `ModelPicker` | Dropdown model + provider |
| `KeySourceSelector` | Chọn K1 / K2 / K3 |
| `WorkflowEditor` | Editor workflow (M4) |

### 3.7 Settings

| Component | FR liên quan |
|---|---|
| `ProviderSettings` | FR-PROVIDER-01/02/08 |
| `ModelPicker` | FR-PROVIDER-03 |
| `ThemeSettings` | FR-SETTINGS-01/02 |
| `PrivacySettings` | FR-CONTEXT-08, FR-SETTINGS-04 |
| `ToolsSettings` | FR-TOOLS-01 |
| `SkillsSettings` | FR-SKILL-03, FR-SKILL-07 |
| `DataSettings` | FR-SETTINGS-03, FR-SETTINGS-07 |
| `ShortcutsSettings` | FR-UX-01 |
| `LanguageSettings` | FR-SETTINGS-06 |
| `WorkflowSettings` | FR-WORKFLOW-08 (M4) |

---

## 4. State & hành vi UI chuẩn hoá

| Trạng thái | Yêu cầu UI | FR |
|---|---|---|
| **Loading khung** | Skeleton cho thread. Không spinner che toàn màn hình | NFR-PERF-03 |
| **Streaming** | Token hiện dần, con trỏ nhấp nháy, không layout shift | FR-CHAT-01, DP-4 |
| **Empty (chưa có chat)** | PromptGallery theo ngữ cảnh trang + nút tạo chat mới | FR-UX-03 |
| **Empty (chưa có context)** | Gợi ý câu hỏi chung + nút bật context | FR-UX-04 |
| **Error network** | Inline trong thread + nút Retry + nguyên nhân cụ thể | FR-CHAT-14 |
| **Error 401 (key)** | Link tới Settings → Provider | FR-CHAT-14 |
| **Error 429** | Đếm ngược giây rồi cho thử lại | FR-CHAT-14 |
| **BFF offline** | Banner cố định + CTA "Nhập API key dùng trực tiếp" (K3) | NFR-REL-03 |
| **Quota đầy** | Badge cảnh báo + link quản lý quota | FR-PROVIDER-06 |
| **Offline (không mạng)** | Badge trạng thái + gợi ý dùng Ollama local | FR-PROVIDER-07 |
| **Đang chờ xác nhận** (M4) | Workflow dừng ở bước, hiện diff + Phê duyệt/Từ chối | FR-WORKFLOW-07 |
| **Context không đọc được** (PDF scan / `file://`) | Chip context báo lỗi rõ + hướng dẫn "hãy upload ảnh"; **không** block chat | FR-CONTEXT-05 |
| **Transcript không có** (YouTube không caption / geo-block) | Chip context báo "không lấy được transcript" + gợi ý dùng mô tả video; **không** block chat | FR-CONTEXT-06 |
| **Context vượt ngân sách** | Badge "đã dùng X/Y token" + liên kết xem phần bị cắt bớt | FR-CONTEXT-07 |
| **Không đính kèm gì (chat thuần LLM)** | Chip "Context" ở trạng thái TẮT · không có chip nguồn · **không** hiện meter · gợi ý "Thêm trang này" nếu user hỏi về trang đang xem | FR-CONTEXT-13 |

---

## 5. Accessibility checklist (WCAG 2.2 AA)

- [ ] Tương phản text ≥ 4.5:1, UI component/icon ≥ 3:1 — kiểm chứng ở **cả** light và dark theme
- [ ] Focus ring rõ ở mọi interactive element; **không** dùng `outline: none` mà không thay thế
- [ ] Mọi icon-button có `aria-label` (tiếng Việt)
- [ ] Streaming dùng `aria-live="polite"` ở cấp **đoạn**, không theo từng token
- [ ] Tab order: header → thread → composer → actions
- [ ] Skip-link "Bỏ qua tới ô nhập"
- [ ] Popover/Dialog đóng bằng `Esc`, trả focus về trigger, focus bị kẹt bên trong khi mở
- [ ] `prefers-reduced-motion` được tôn trọng
- [ ] Zoom 200% không mất chức năng (FR-UX-09)
- [ ] Target size ≥ 24×24px (khuyến nghị 44×44)
- [ ] Không dùng màu là tín hiệu duy nhất (trạng thái có icon + text)
- [ ] Form control có `<label>` liên kết, không chỉ placeholder

---

## 6. Component ↔ Requirement traceability

| Nhóm component | Requirements phục vụ | Ảnh hưởng eval |
|---|---|---|
| `ContextChips`, `MentionPopover` | FR-CONTEXT-02/03/08/09 | R7 privacy transparency |
| `ContextBudget` | FR-CONTEXT-07 | Minh bạch context · hỗ trợ rubric R4 |
| `ContextChips` (trạng thái lỗi PDF/YouTube) | FR-CONTEXT-05/06 | Đối chiếu A20 / B10 |
| `CitationChip`, `CitationPopover` | FR-CONTEXT-10 | `citation_precision`, rubric R5 |
| `CodeBlock`, `MarkdownTable` | FR-CHAT-03/04 | Rubric R6 (UX) |
| `ToolCallBlock` | FR-TOOLS-02/06 | `tool_success_rate` |
| `SkillMenu` | FR-SKILL-01/02 | Parity với Chrome Gemini |
| `PromptGallery` | FR-UX-03 | Parity với Edge Copilot |
| `Composer` | FR-CHAT-12/13 | Rubric R4 (instruction following) |
| `ErrorMessage` | FR-CHAT-14 | Độ ổn định, khó đo |
| `ThemeSettings` | FR-SETTINGS-01/02 | WCAG |
| `Onboarding` | FR-UX-02 | Parity 3 bước lần đầu |
| `AttachmentTray`, ảnh trong `MessageBubble` | FR-VISION-01 | Đối chiếu B17 (Gemini upload ảnh) |
| `UsageBadge`, `ProviderBadge` | FR-PROVIDER-05/09 | Bảng 3 "năng lực hệ thống" |

---

## 7. Deliverables của giai đoạn Design System

| Deliverable | Nội dung | Nơi |
|---|---|---|
| `design/tokens.json` | Token dạng JSON — nguồn sự thật duy nhất | `design/tokens.json` |
| `design/tokens.css` | CSS variables đã generate | `design/tokens.css` |
| `design/components.md` | Spec từng component: anatomy, states, props, a11y | `design/components.md` |
| `design/patterns.md` | Pattern: streaming message, citation, tool call, empty state, error | `design/patterns.md` |
| `design/a11y-audit.md` | Kết quả audit WCAG 2.2 AA | `design/a11y-audit.md` |
| `apps/extension/src/components/ui/` | shadcn/ui components đã copy + chỉnh sửa | repo |
| Storybook | Component playground (khuyến nghị, có thể để M3) | `apps/extension/.storybook/` |

---

## 8. Design system ↔ Eval: những điểm được chấm bằng mắt

Rubric eval có **R6 (UX & Latency)** và **R8 (Overall usefulness)** do con người chấm, và giảng viên sẽ xem ảnh chụp màn hình. Vì vậy các điểm sau **phải được ưu tiên cao**:

1. Rõ ràng trạng thái context (chip tab đang share) — đồng thời là điểm R7 privacy.
2. Trích dẫn bấm được, hiển thị rõ đoạn nguồn.
3. Code block sạch, copy dễ, ngôn ngữ hiển thị.
4. Trạng thái rỗng có gợi ý hữu ích (không phải màn hình trống trơn).
5. Streaming mượt, không nhảy layout.
6. Thông báo lỗi dễ hiểu, có nút khôi phục.
7. Hiển thị model + token + cost (điểm khác biệt với 2 hệ thống đối chiếu).

---

## 9. Open questions

| # | Câu hỏi | Đã chốt? | Ghi chú |
|---|---|---|---|
| DS-Q1 | Tông màu chủ đạo (tím như Gemini / xanh như Copilot / trung tính)? | ❌ | Trung tính có lợi: tránh bị so sánh "giống hệt" hệ thống có sẵn |
| DS-Q2 | Bộ component nền | ✅ **Tailwind + shadcn/ui (Radix)** | Copy code vào repo, sở hữu 100% |
| DS-Q3 | Cần dark theme ngay từ đầu? | ❌ | Đề xuất: có, vì cả 2 hệ thống đối chiếu đều hỗ trợ → parity |
| DS-Q4 | Mức độ motion/stagger cho streaming? | ❌ | Đề xuất: tối giản (chỉ con trỏ) để không tốn FPS |
| DS-Q5 | Cần logo/illustration riêng cho Sidekick AI? | ❌ | Ảnh hưởng branding trong demo video |
