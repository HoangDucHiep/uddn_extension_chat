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
| Code block + highlight | — | `CodeBlock` (`rehype-highlight` + `lowlight`, highlight tĩnh) |
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
| `ConversationList` (đã implement T-M1-09) | Drawer trái (Radix Dialog trượt từ trái): danh sách chat, search, pin, lưu trữ, đổi tên, xoá | FR-CHAT-08/09/11 | Chi tiết §3.2.1 |
| `SettingsPanel` | Route/modal, chia section theo nhóm FR | FR-SETTINGS-* | |
| `StatusBadge` | Chip trạng thái: online / offline / BFF down / quota | NFR-REL-03/04 | |

#### 3.2.1 `ConversationList` — drawer quản lý cuộc trò chuyện (đã implement T-M1-09)

> Nguồn: [`REQUIREMENTS.md`](REQUIREMENTS.md) §4.1 (FR-CHAT-08, FR-CHAT-09, FR-CHAT-11) · kiến trúc: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.10.

**Vì sao là drawer (overlay) chứ không phải sidebar thu hẹp?**

DP-2 quy định thread chat chiếm ≥ 90% không gian panel (DP-1: panel hẹp 320–640 px). Thu hẹp panel để chia 2 cột sẽ phá DP-2. Drawer **overlay** giữ nguyên layout thread, chỉ phủ khi mở.

**Cấu trúc:**

| Phần | Nội dung |
|---|---|
| Header drawer | Tiêu đề "Cuộc trò chuyện" + nút đóng (Radix `DialogClose`, `aria-label="Đóng"`) |
| "Chat mới" | Button full-width — tạo conversation mới + xoá thread |
| Search | `Input` + icon `Search` · debounce **250 ms** · `aria-label="Tìm cuộc trò chuyện theo tên"` |
| Tabs | "Đang dùng" (`archived=false`) / "Đã lưu trữ" (`archived=true`) — `role="tablist"` |
| Nhóm | "Đã ghim" (conversation `pinned`) / "Gần đây" — `aria-label` = tên nhóm |
| Dòng | Title truncate + 4 nút icon: `Pin`/`PinOff` · `Archive`/`ArchiveRestore` · `Pencil` · `Trash2` |
| Dòng active | Nền `--color-accent-subtle` + `aria-current="true"` |

**Token:** nền drawer `--surface-overlay` · viền phải `--border-default` · đổ bóng `--shadow-3` · chữ `--text-primary` / `--text-secondary` / `--text-tertiary` · focus ring `--border-focus`.

**Motion:** `sidekick-drawer-in` (opacity + `translateX(-12px) → 0`) · overlay `sidekick-fade-in` · **tôn trọng `prefers-reduced-motion`** (`animation: none`).

**A11y:** mọi nút icon có `aria-label` tiếng Việt · drawer đóng bằng `Escape` (Radix lo) · focus bị khoá trong dialog khi mở · `DialogTitle` dùng `sr-only` để screen reader đọc được.

**Không có UI mới ngoài drawer:** không thêm tab ngang trong panel (sẽ phá DP-2) · không thêm menu chuột phải (không có UX chuẩn ở side panel).

### 3.3 Thread

| Component | Mô tả | FR liên quan | Rủi ro nếu thiết kế sai |
|---|---|---|---|
| `MessageList` | Virtualize, auto-scroll, nút "cuộn xuống" | FR-UX-05 | Jank khi response dài |
| `UserMessage` | Bubble, edit / copy / delete / branch | FR-CHAT-06, FR-CHAT-08 | |
| `AssistantMessage` | Render markdown + actions row | FR-CHAT-02 | |
| `MessageActions` | Regenerate, switch biến thể, continue, edit | FR-CHAT-05 | |
| `MessageEditBox` | Sửa tin nhắn user inline (textarea + "Gửi lại" / "Hủy") | FR-CHAT-06 | |
| `ScrollToBottomButton` | Nút tròn "Cuộn xuống" khi thread lệch khỏi đáy | FR-UX-05 | Kéo thread về đáy khi user đang đọc phần trên |
| `CodeBlock` | Highlight, copy, ngôn ngữ, expand | FR-CHAT-03 | Ảnh hưởng rubric R6 |
| `MarkdownTable` | Bảng, scroll ngang | FR-CHAT-04 | Vỡ layout ở panel hẹp |
| `MessageContent` | Orchestrator render Markdown của message assistant (defer khi streaming) | FR-CHAT-02 | Jank khi stream dài (NFR-PERF-02) |
| `CitationChip` | `[1]` chip → popover xem đoạn nguồn | FR-CONTEXT-10 | **Ảnh hưởng trực tiếp metric `citation_precision` trong eval** |
| `CitationPopover` | Preview đoạn nguồn + mở tab gốc | FR-CONTEXT-10 | |
| `CitationList` | Dòng tóm tắt nguồn dưới bubble assistant | FR-CONTEXT-10 | Thiếu → user không biết tổng cộng có bao nhiêu nguồn |
| `ToolCallBlock` | Collapsible: tên tool, args, kết quả | FR-TOOLS-02, FR-TOOLS-06 | Ảnh hưởng `tool_success_rate` |
| `StreamingIndicator` | Con trỏ, shimmer, "Đang suy nghĩ" | FR-CHAT-01 | |
| `ErrorMessage` | Lỗi + hành động khôi phục | FR-CHAT-14 | Ảnh hưởng độ ổn định đo được |
| `AttachmentChip` | Ảnh đính kèm trong message | FR-VISION-01 | |
| `UsageBadge` | Token in/out + cost của lượt đó | FR-PROVIDER-05 | |
| `PromptGallery` | Empty state: grid gợi ý theo loại trang + nút refresh + nút "Tóm tắt trang này" | FR-UX-03, FR-UX-04 | Gợi ý sai ngữ cảnh → user bấm nhầm |
| `SummarizeButton` | Nút chính "Tóm tắt trang này" 1-click | FR-UX-04 | Thiếu → mất điểm parity Edge "Create a Summary" / Gemini "Summarize" |

#### `MessageActions` (đã implement T-M1-10)

- **Vị trí:** hàng nhỏ dưới nội dung bubble, chỉ hiện khi có thao tác khả dụng.
- **User bubble:** một icon-button "Sửa tin nhắn" (`Pencil`) → mở `MessageEditBox` inline.
- **Assistant bubble:**
  - Icon-button "Tạo lại câu trả lời" (`RefreshCw`) → `operation: 'regenerate'`.
  - Icon-button "Tiếp tục câu trả lời" (`RotateCcw`) — **chỉ hiện** khi `message.aborted === true` (đã bị stop giữa chừng).
  - Switcher biến thể: nút text `"2/3"` → Radix `Popover` liệt kê các biến thể, đánh dấu biến thể đang dùng (`aria-current="true"`). **Chỉ hiện** khi turn có > 1 biến thể.
- **Trạng thái:** icon-button bị `disabled` khi đang streaming (tránh thao tác chồng nhau).
- **Token:** `--text-secondary` (icon) · `--surface-sunken` (nền hover) · `--text-primary` (nhãn switcher) · `--border-default` · `--focus-ring`.
- **A11y:** mọi icon-button có `aria-label` tiếng Việt; switcher có `aria-label="Chọn biến thể câu trả lời, hiện tại 2/3"`; focus ring theo token; không dùng màu là tín hiệu duy nhất (biến thể đang dùng có chữ "(đang dùng)").

#### `MessageEditBox` (đã implement T-M1-10)

- **Vị trí:** thay thế nội dung bubble user khi đang sửa (inline, không mở modal).
- **Nội dung:** `Textarea` (auto-grow) + hàng nút "Hủy" (`ghost`) · "Gửi lại" (`default`).
- **Keyboard:** Enter → gửi lại · Shift+Enter → xuống dòng · Esc → huỷ (không gửi).
- **Trạng thái:** nút "Gửi lại" disabled khi nội dung rong hoặc đang xử lý.
- **Token:** `--surface-raised` (nền) · `--border-default` (viền) · `--radius-md` · `--space-2` / `--space-3`.
- **A11y:** `Textarea` có `aria-label="Sửa nội dung tin nhắn"`; focus tự động vào textarea + con trỏ đặt cuối khi mở.

#### `ScrollToBottomButton` (đã implement T-M1-10)

- **Vị trí:** nút tròn float, giữa theo chiều ngang, sát đáy thread (`bottom: var(--space-3)`), nằm **trong** wrapper tương đối của vùng thread.
- **Điều kiện hiện:** thread lệch khỏi đáy > `SCROLL_BOTTOM_THRESHOLD` (80 px) → hiện; bấm → cuộn về đáy + reset trạng thái.
- **Nội dung:** icon `ChevronDown` trong nút tròn `size="icon"`, nền `--surface-overlay` + viền `--border-default` + `--shadow-2`.
- **A11y:** `aria-label="Cuộn xuống cuối hội thoại"`; nút luôn có focus ring rõ.

#### `PromptGallery` (đã implement T-M1-11)

- **Vị trí:** thay khối empty state trong vùng thread (`ChatWorkspace`) — canh giữa theo chiều ngang, dồn theo chiều dọc.
- **Cấu trúc:** tiêu đề "Chào bạn!" + nhãn ngữ cảnh ("Gợi ý cho tài liệu: {title}") + nút refresh nhỏ (`RefreshCw`) → grid 1 cột các chip gợi ý → nút "Tóm tắt trang này" → dòng ghi chú nhỏ "Sẽ tự đính kèm trang này khi bạn chọn gợi ý".
- **Chip gợi ý:** nút full-width, `--surface-raised` (nền) · `--border-default` (viền) · `--radius-md`; 2 dòng: **nhãn** (`--text-primary`, `--font-size-sm`) + **preview prompt** (`--text-tertiary`, `--font-size-xs`, `line-clamp-2`).
- **Refresh:** icon-button tròn nhỏ cạnh nhãn ngữ cảnh; `aria-label="Làm mới gợi ý"`; xoay vòng deterministic trong cùng profile.
- **Điều kiện hiện nút tóm tắt:** chỉ khi trang hiện tại đọc được (`http`/`https`). Không có tab đọc được → chỉ hiện gợi ý chung (FR-UX-04), **không** hiện nút tóm tắt.
- **Trạng thái:** mọi chip + nút refresh + nút tóm tắt `disabled` khi đang gửi (`isStreaming` hoặc `isAttaching`).
- **Token:** `--text-primary` · `--text-secondary` · `--text-tertiary` · `--surface-raised` · `--surface-sunken` (hover) · `--border-default` · `--radius-md` · `--space-2` / `--space-3` / `--space-4`. **Không hardcode màu.**
- **A11y:** chip gợi ý là `<button>` thật (focus ring rõ) · refresh có `aria-label` tiếng Việt · dòng ghi chú dùng `--text-tertiary` nhưng vẫn đọc được (≥ 4.5:1).

#### `SummarizeButton` (đã implement T-M1-11)

- **Vị trí:** trong `PromptGallery`, full-width, ngay trên dòng ghi chú minh bạch.
- **Nội dung:** icon `FileText` (`lucide-react`) + chữ "Tóm tắt trang này"; variant `default`, size `sm`.
- **Trạng thái:** `disabled` khi đang gửi.
- **A11y:** `aria-label="Tóm tắt trang này"`; focus ring theo token `--border-focus`.

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

#### `MessageContent` (đã implement T-M1-07)

- **Vị trí:** thay thế `<p class="whitespace-pre-wrap">` trong `MessageBubble` — **chỉ message assistant**; message user giữ text thuần.
- **Vai trò:** orchestrator của pipeline `react-markdown` → `remark-gfm` → `rehype-highlight` → `rehype-sanitize` (chi tiết kỹ thuật: `SYSTEM_DESIGN.md` §7.8).
- **Hiệu năng:** `useDeferredValue(content)` + **highlight defer khi streaming** (code block dạng plain mono khi `status === 'streaming'`, highlight 1 lần khi stream xong) → không nhấp nháy unhighlighted, không jank (NFR-PERF-02).
- **Style:** class `.markdown-body` trong `src/sidepanel/index.css` (CSS thuan, không phải Tailwind arbitrary trong JSX) — margin theo `--space-*`, heading theo `--font-size-*` + `--font-weight-semibold`, link `--info` + underline.

#### `CodeBlock` (đã implement T-M1-07)

- **Cấu trúc:** `<div data-testid="code-block">` = header (nhãn ngôn ngữ + nút copy) + `<pre>` (nội dung code).
- **Header:** nhãn ngôn ngữ (`typescript`, `python`, …; không có → `text`) — font mono, **uppercase**, `--text-tertiary`, `--font-size-xs`. Nút copy 24×24 px, icon `Copy` (`lucide-react`) → đổi sang `Check` trong 1500 ms sau khi copy.
- **Phản hồi copy:** `navigator.clipboard.writeText(source code thô)` → toast `sonner` `toast.success('Đã sao chép')`; lỗi → `toast.error('Không sao chép được')`. Copy **source thô**, không phải HTML.
- **Token:** `--code-bg` (nền) · `--code-border` (viền + đường kẻ header) · `--code-fg` (màu chữ) · `--text-tertiary` (nhãn + icon) · `--surface-sunken` (hover nút) · `--font-mono` · `--font-size-xs` · `--font-size-sm` · `--radius-md` · `--radius-sm` · `--duration-fast`.
- **A11y:** nút copy có `aria-label="Sao chep code"` (tiếng Việt) · focus ring `--focus-ring` · `<pre>` có `overflow-x-auto` (code dài scroll ngang, không vỡ layout).

#### `MarkdownTable` (đã implement T-M1-07)

- **Cấu trúc:** `<div data-testid="markdown-table-wrapper" class="overflow-x-auto">` bọc `<table>`.
- **Hành vi:** bảng GFM rộng hơn panel (320 px) → **scroll ngang**, không vỡ layout (FR-CHAT-04).
- **Token:** `--border-default` (viền bảng + ô) · `--surface-sunken` (nền header `th`) · `--text-primary` (header) · `--font-size-sm` · `--space-2` (padding ô).
- **Chi tiết:** `white-space: nowrap` trên ô → nội dung không bị vỡ dòng vô nghĩa.

#### Mapping màu syntax highlight → design token (T-M1-07)

`rehype-highlight` sinh class `hljs-*`; mapping trong `src/sidepanel/index.css` → **dùng token có sẵn trong `design/tokens.css`, không hardcode hex**:

| Class highlight.js | Token |
|---|---|
| `hljs-keyword` · `hljs-selector-tag` · `hljs-literal` · `hljs-type` · `hljs-name` | `--code-token-keyword` |
| `hljs-string` · `hljs-regexp` · `hljs-attribute` | `--code-token-string` |
| `hljs-number` · `hljs-variable` · `hljs-tag .hljs-attr` | `--code-token-number` |
| `hljs-comment` · `hljs-quote` · `hljs-meta` | `--code-token-comment` |
| `hljs-title` · `hljs-built_in` · `hljs-selector-id` / `-class` | `--code-token-function` |
| `hljs-punctuation` · `hljs-operator` · `hljs-subst` · `hljs-params` | `--code-token-punctuation` |

Token đổi theo theme `.dark` → highlight tự đổi màu, không cần code.

#### `CitationChip` / `CitationPopover` / `CitationList` (đã implement T-M1-08)

- **Cấu trúc chip:** `<button class="citation-chip" data-testid="citation-chip-{N}" aria-label="Xem nguồn {N}: {title}">[N]</button>` — inline trong câu trả lời, `vertical-align: super`.
  - **Có** metadata (đã nhận SSE event `citation`) → chip là **button** mở popover.
  - **Chưa** có metadata (đang stream) → chip là `<span>` — không popover, không "chip chết".
- **Popover:** Radix Popover (`shadcn/ui/popover`) render qua **Portal** → không bị `overflow` của thread chat cắt. Nội dung: tiêu đề · domain (bỏ `www.`) · đoạn trích (`max-h-[160px]`, scroll) · nút "Mở trang gốc" (`chrome.tabs.create`).
- **`CitationList`:** `<ul data-testid="citation-list">` dưới bubble assistant — mỗi nguồn 1 item: badge số + domain (fallback tiêu đề), `truncate` + `max-w-[180px]`.
- **Token:** `--citation-bg` (nền chip) · `--citation-border` (viền) · `--citation-link` (chữ số) · `--citation-hover` (hover) · `--surface-overlay` + `--shadow-2` + `--radius-md` + `--border-default` (popover) · `--font-size-xs` · `--radius-sm`. **Không hardcode màu.**
- **A11y:** chip là button có `aria-label` tiếng Việt; focus ring dùng `--border-focus` + `--focus-ring-offset`; popover đóng bằng `Escape`/blur (Radix lo).
- **Chi tiết:** [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.9.

### 3.5 Selection affordance (đã implement T-M1-02)
Component `SelectionAffordance` — nút nổi "Hỏi Sidekick" xuất hiện cạnh vùng text user bôi đen **trong trang web** (không phải trong panel).

- **Vị trí:** **overlay nổi** trong trang — `position: fixed`, neo theo bounding box của vùng chọn (ưu tiên **dưới** vùng chọn; tran cạnh dưới viewport → **trên**; toạ độ luôn clamp trong viewport).
- **Cô lập CSS:** nút nằm trong `attachShadow({ mode: 'open' })` → CSS của trang host **không** ghi đè được style của nút (và ngược lại).
- **Token:** CSS cho shadow root được **sinh tự động** từ `design/tokens.json` (`apps/extension/src/content/selectionStyles.ts`) → `--color-accent` · `--color-accent-fg` · `--surface-overlay` · `--border-strong` · `--text-primary` · `--text-secondary` · `--shadow-2` · `--radius-md` · `--font-size-sm` · `--font-sans`. Có biến thể `prefers-color-scheme: dark` để khớp theme hệ điều hành. **Không hardcode màu.**
- **A11y:** `<button type="button">` với `aria-label="Hỏi Sidekick về đoạn văn bản đã bôi đen"` (tiếng Việt) · icon SVG `aria-hidden="true"` · focus ring `--focus-ring` rõ ràng · `prefers-reduced-motion` không có animation nào để vi phạm.
- **Điều kiện hiện:** chỉ hiện khi vùng chọn ≥ `LIMITS.MIN_SELECTION_CHARS` (10 ký tự) → không gây phiền khi user chỉ click chuột. Ẩn ngay khi selection bị thu hồi hoặc trang scroll.
- **Đóng góp bundle:** content script build IIFE 1 file → **không** dùng `lucide-react` ở đây (kéo theo cả thư viện UI) → icon SVG viết tay.

Nút tương ứng trong panel: `ContextChips` → nút "Dính đoạn đã chọn" (icon `MousePointer2`, `data-testid="context-add-selection"`).

### 3.5.1 Cache context theo URL (T-M1-06) — **KHÔNG có UI mới**

> Nguồn: [`REQUIREMENTS.md`](REQUIREMENTS.md) §4.2 (FR-CONTEXT-01) · kiến trúc: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.3.5.

| Hạng mục | Kết luận |
|---|---|
| Component mới | **Không** — không có UI nào được thêm |
| Design token mới | **Không** — không dùng màu/giá trị mới |
| Hành vi chip hiện tại | **Không đổi** — `ContextChips` / `ContextBudget` giữ nguyên |
| a11y | **Không đổi** — không có interactive element mới |

Cache context chạy **hoàn toàn ngầm** ở tầng `lib/` (`contextCache.ts` + `contextAttach.ts`):

- User bấm "Thêm trang này" → `attachTab()` trích xuất → nếu thành công thì **ghi vào cache** (không có phản hồi trực quan nào cho user).
- Lần sau bấm lại cùng trang, hoặc trang đang lỗi → dùng bản cache → chip hiện **y hệt** như bình thường (vì `ContextItem` trả về giống nhau).

> **Vì sao không hiện badge "đang lấy từ cache"?** DP-3 nói context luôn nhìn thấy, nhưng cache là **tối ưu kỹ thuật**, không phải thay đổi nguồn sự thật mà user cần biết. Hiện badge sẽ gây nhiễu (DP-2) và tạo cảm giác "nội dung bị cũ" khi thực ra cache vừa mới (TTL 30 phút). Nếu sau này cần minh bạch, có thể thêm vào `ContextNotice` (M2) — nhưng đó là quyết định sản phẩm riêng.

### 3.6 Overlays & feedback

| Component | Mô tả |
|---|---|
| `Toast` (sonner) | Thông báo không chặn nội dung |
| `ConfirmDialog` (đã implement T-M1-09) | Xoá / hành động phá huỷ — bọc Radix Dialog, nút nguy hiểm dùng variant `danger`, disable 2 nút khi đang xử lý (`isBusy`) — chi tiết §3.6.1 |
| `PromptGallery` | Prompt gợi ý theo ngữ cảnh trang |
| `Onboarding` (đã implement T-M1-25) | 3 bước lần đầu: quyền → chọn provider → thử câu hỏi — chi tiết §3.8 |
| `ModelPicker` | Dropdown model + provider |
| `KeySourceSelector` | Chọn K1 / K2 / K3 |
| `WorkflowEditor` | Editor workflow (M4) |

#### 3.6.1 `ConfirmDialog` (đã implement T-M1-09)

> Nguồn: [`REQUIREMENTS.md`](REQUIREMENTS.md) §4.1 (FR-CHAT-08 — "Xoá cả nhóm → có confirm dialog").

| Prop | Mặc định | Ghi chú |
|---|---|---|
| `open` | — | Quyền kiểm soát hiển thị (Radix `Dialog.Root`) |
| `title` | — | Bắt buộc — `DialogTitle` (a11y) |
| `description` | — | Tuỳ chọn — `DialogDescription` |
| `confirmLabel` / `cancelLabel` | "Xác nhận" / "Huỷ" | Text tiếng Việt |
| `destructive` | `false` | `true` → nút xác nhận dùng variant `danger` (màu đỏ) |
| `onConfirm` | — | Có thể là `async` → `isBusy` disable 2 nút trong lúc chờ |

- Bọc Radix Dialog → overlay + focus trap + `Escape` đóng đều do Radix lo.
- **Bắt buộc** cho mọi hành động phá huỷ dữ liệu (xoá conversation). Không dùng `window.confirm` (không style được, không nhất quán theme).
- `data-testid`: `confirm-dialog` · `confirm-accept` · `confirm-cancel`.

### 3.7 Settings

**Đã implement T-M1-12** — drawer Settings trượt từ **phải** (Radix `Dialog`), mở bằng nút gear (`Settings`, `aria-label="Mở cài đặt"`, `data-testid="settings-button"`) trong `PanelHeader`. Drawer **giữ nguyên** context chat phía sau (DP-2: thread ≥ 90%).

| Component | FR liên quan | Trạng thái |
|---|---|---|
| `SettingsDrawer` | FR-SETTINGS-01..07 | ✅ T-M1-12 — orchestrator, 6 section · **T-M1-18** thêm section "Phím tắt" (7 section) |
| `ThemeSettings` | FR-SETTINGS-01/02 | ✅ T-M1-12 — radio `Sáng` / `Tối` / `Theo hệ điều hành` |
| `AppearanceSettings` | FR-SETTINGS-02 + FR-UX-06 | ✅ T-M1-12 — cỡ chữ (4 mức) · mật độ (3 mức) · bề rộng (3 mức) |
| `PrivacySettings` | FR-CONTEXT-08, FR-SETTINGS-04 | ✅ T-M1-12 — toggle telemetry (OFF mặc định) · toggle history (OFF mặc định) |
| `DataSettings` | FR-SETTINGS-03, FR-SETTINGS-07, NFR-SEC-07 | ✅ T-M1-12 — xoá lịch sử chat · xoá dữ liệu cục bộ · export/import JSON |
| `EndpointSettings` | FR-SETTINGS-05 | ✅ T-M1-12 — input URL + "Kiểm tra & lưu" (`GET <url>/api/health`) |
| `LanguageSettings` | FR-SETTINGS-06 | ✅ T-M1-12 — radio VI/EN (chỉ lưu lựa chọn; dịch UI → T-M1-17) |
| `ShortcutsSettings` | FR-UX-01 | ✅ **T-M1-18** — 2 lớp phím tắt (native của Chrome + nhanh của Sidekick) · bấm "Đổi" → ô bắt phím · "Về mặc định" · "Mở trang phím tắt" |
| `SettingsControls` | (dùng chung) | ✅ T-M1-12 — `RadioGroup` · `ToggleRow` · `SettingsSection` |
| `SkipLink` | FR-UX-07, NFR-A11Y-04 | ✅ **T-M1-20** — anchor `#sidekick-composer-input` · `sr-only focus:not-sr-only` |
| `ProviderSettings` | FR-PROVIDER-01/02/08 | ⏸ **tạm dừng** *(BYOK — quyết định user 2026-11-08)* |
| `ModelPicker` | FR-PROVIDER-03 | ⬜ T-M2-02 |
| `ToolsSettings` | FR-TOOLS-01 | ⬜ T-M2-05 |
| `SkillsSettings` | FR-SKILL-03, FR-SKILL-07 | ⬜ T-M2-04 |
| `WorkflowSettings` | FR-WORKFLOW-08 (M4) | ⬜ M4 |

#### 3.7.1 Section "Phím tắt" (đã implement T-M1-18)

**2 lớp phím tắt** — vì Chrome **không** có `chrome.commands.update()` / `reset()` (API riêng của Firefox):

| Lớp | Nhãn | Nội dung | Nguồn |
|---|---|---|---|
| 1 — native | "Phím tắt gốc (Chrome)" | shortcut đang gán + nút **"Mở trang phím tắt"** (`chrome://extensions/shortcuts`) | `chrome.commands.getAll()` |
| 2 — nhanh | "Phím tắt nhanh (trong panel)" | tổ hợp + nút **"Đổi"** (bấm để bắt phím) + nút **"Về mặc định"** (icon `RotateCcw`, disable khi đang ở mặc định) | `chrome.storage.local` key `sidekick.shortcuts` |

- **Bố cục:** mỗi command là 1 khối `rounded-[var(--radius-md)] border border-[var(--border-subtle)]`, 2 hàng bên trong (lớp 1 · lớp 2).
- **Shortcut hiển thị** bằng class `font-mono` + `--text-secondary` → phân biệt được với nhãn.
- **Ô bắt phím** = `<button>` có `border-[var(--color-accent)]` + `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]` → nhấn phím để gán, `Esc` để huỷ.
- **Lỗi** hiển thị trong `<p role="alert">` màu `--danger` (`shortcut-error`) — 2 nghĩa: `invalid` (tổ hợp sai) · `reserved` (trùng shortcut hệ thống).
- **Tap target:** nút "Về mặc định" là icon-button → `aria-label` tiếng Việt ("Về mặc định") + kích thước ≥ 24px.
- **Token dùng:** `--radius-md` · `--radius-sm` · `--border-subtle` · `--color-accent` · `--text-primary` · `--text-secondary` · `--text-tertiary` · `--danger` · `--font-size-xs` · `--font-size-sm`.
- Chi tiết kỹ thuật: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.18.

**Token dùng** (không hardcode màu): `--surface-overlay` · `--surface-sunken` · `--text-primary` · `--text-secondary` · `--text-tertiary` · `--border-subtle` · `--color-accent` · `--danger` · `--space-*` · `--radius-*`.

**Biến CSS áp từ settings** (đặt trên `<html>`, không cần sửa component nào):

| Biến | Nguồn | Giá trị |
|---|---|---|
| `--font-scale` | `fontScale` | `0.9` · `1` · `1.1` · `1.2` |
| `--density-scale` | `density` | `0.85` (compact) · `1` (cozy) · `1.15` (comfortable) — nhân vào token `--space-*` |
| `--panel-max-width` | `panelWidth` | `400px` (narrow) · `640px` (default) · `960px` (wide) |
| `.dark` + `data-theme` | `theme` | `light` · `dark` (theme `system` → theo `prefers-color-scheme`) |

**A11y**:

| Điểm | Cách làm |
|---|---|
| Radio group | `<input type="radio">` native + `<label>` — điều hướng bàn phím mặc định đúng, không thêm component UI mới |
| Toggle | `<input type="checkbox">` native + `<label>` |
| Nút gear | `aria-label="Mở cài đặt"` tiếng Việt · icon `aria-hidden="true"` |
| Ô nhập endpoint | `<label htmlFor="settings-bff-url">` liên kết `id` · `type="url"` |
| File import | `<input type="file" accept="application/json,.json">` ẩn + nút trigger; không chặn focus |
| Focus | Mọi interactive element có focus ring rõ (không `outline: none`) |
| Motion | `animate-drawer-in-right` (12px translate) → tôn trọng `prefers-reduced-motion` |

> `data-testid` cho E2E: `settings-button` · `settings-drawer` · `settings-theme` · `settings-font-scale` · `settings-density` · `settings-panel-width` · `settings-telemetry` · `settings-history` · `settings-delete-history` · `settings-delete-local` · `settings-export` · `settings-import` · `settings-import-input` · `settings-bff-url` · `settings-bff-check` · `settings-bff-reset` · `settings-language` · `radio-<value>`.

> **Giới hạn đã biết:** bề rộng panel do người dùng kéo trong Chrome → extension chỉ đặt thêm `max-width`. Không thể cưỡng chế bề rộng tuyệt đối (ghi rõ trong UI).

### 3.8 Onboarding (đã implement T-M1-25)

Component `Onboarding` — màn hình **thay** nội dung chat trong side panel khi mở lần đầu.

| Sub-component | Nội dung |
|---|---|
| `Onboarding` | Orchestrator: progress bar 3 bước, điều hướng "Tiếp tục" / "Quay lại", nút "Bỏ qua" |
| `StepPermissions` | Liệt kê quyền extension + lý do cần; nút "Mở cài đặt trình duyệt" |
| `StepProvider` | Radio list provider + ô nhập API key (chỉ khi provider cần key) |
| `StepTry` | Ô nhập câu hỏi + nút "Thử" → hiện câu trả lời stream |

**Token dùng** (không hardcode màu): `bg-surface` · `text-primary` · `text-secondary` · `border-subtle` · `bg-accent` · `text-accent-fg` · `bg-accent-subtle` · `var(--space-*)` · `var(--radius-*)`.

**A11y**:

| Điểm | Cách làm |
|---|---|
| Radio group provider | `<input type="radio">` native + `<label htmlFor>` — điều hướng bằng bàn phím mặc định đúng, không cần thêm component UI |
| Ô nhập API key | `<input type="password">` + `<label>` liên kết bằng `htmlFor`/`id`; không log giá trị ra console |
| Nút icon | `aria-label` tiếng Việt (vd "Hướng dẫn", "Mở cài đặt trình duyệt") · icon `aria-hidden="true"` |
| Tiến trình | `aria-current="step"` trên bước đang làm; progress bar có `aria-label` |
| Focus | Mọi interactive element có focus ring rõ (không `outline: none`); khi chuyển bước, focus về tiêu đề bước |
| Motion | Không có animation riêng → `prefers-reduced-motion` không bị vi phạm |

**Phân cách bước 2**: phần "chọn provider" và phần "nhập key" là 2 khối riêng — provider không cần key (Ollama, mock) thì **không** hiện ô nhập key, tránh gây hiểu nhầm.

**Entry mở lại**: nút "Hướng dẫn" (icon `CircleHelp`) trong `PanelHeader` → `resetOnboarding()` → panel hiện lại onboarding.

> `data-testid` cho E2E: `onboarding` · `onboarding-step-permissions` · `onboarding-step-provider` · `onboarding-step-try` · `onboarding-step-counter` · `onboarding-skip` · `onboarding-next` · `onboarding-back` · `onboarding-complete` · `onboarding-api-key` · `onboarding-save-key` · `onboarding-key-error` · `onboarding-key-success` · `onboarding-saved-key-id` · `onboarding-try-input` · `onboarding-try-send` · `onboarding-try-stop` · `onboarding-try-answer` · `onboarding-try-error` · `onboarding-providers-loading` · `onboarding-providers-error` · `onboarding-open-settings` · `onboarding-extension-id`.

### 3.9 States — loading / empty / error / offline (đã implement T-M1-19)

Folder `apps/extension/src/sidepanel/components/states/` — **4 trạng thái** của side panel dùng **một điểm vào chung**, đảm bảo panel không bao giờ hiện màn hình trắng/chết.

| Component | Nội dung | FR |
|---|---|---|
| `LoadingState.tsx` | Skeleton rows cho thread (đang tải lịch sử hội thoại) | NFR-PERF-03 |
| `EmptyState.tsx` | Wrapper mỏng của `PromptGallery` (đã có ở T-M1-11) | FR-UX-03/04 |
| `ErrorState.tsx` | Card lỗi inline trong bubble + 1 hành động theo nhóm lỗi | FR-CHAT-14, FR-UX-08 |
| `ConnectionBadge.tsx` | Chip trạng thái kết nối trong `PanelHeader` | NFR-REL-04, DP-6 |

#### 3.9.1 `ErrorState` — card lỗi inline

- **Vị trí:** trong bubble assistant, thay dòng chữ đỏ thô trước đây (`MessageBubble.tsx`).
- **Bố cục:** icon (theo nhóm lỗi) · tiêu đề ngắn · mô tả nguyên nhân cụ thể · **1 hành động chính** · nút dismiss `✕` (`aria-label="Ẩn thông báo lỗi"`).
- **Hành động theo nhóm lỗi** (`data-error-kind` trên card):

| Nhóm | Hành động | Ghi chú |
|---|---|---|
| `auth` (401/403) | **"Kiểm tra API key"** → mở drawer Settings | Không có nút Retry (retry cũng lỗi) |
| `rate-limit` (429) | **"Thử lại sau Ns"** — đếm ngược **tương tác** | Nút disabled tới khi đếm về 0 → tự đổi thành "Thử lại" |
| `network` / `server` / `provider` / `unknown` | **"Thử lại"** | `retryMessage(messageId)` gửi lại lượt đó |

- **Token:** `--surface-raised` (nền) · `--border-default` (viền) · `--text-primary` / `--text-secondary` · `--color-danger` (icon lỗi) · `--color-accent` (nút hành động) · `--radius-md` · `--space-2`/`--space-3` · `--font-size-sm`. **Không hardcode màu.**
- **A11y:** `role="alert"` + `aria-live="polite"` (đếm ngược không spam screen reader — text thay đổi 1 lần/giây được `aria-live` ở mức polite) · nút hành động là `<button>` thật · dismiss là icon-button có `aria-label` tiếng Việt · focus ring `--border-focus`.
- **Motion:** skeleton dùng `animate-pulse` → `prefers-reduced-motion` tắt animation.

> `data-testid` cho E2E: `error-state` · `error-state-message` · `error-state-retry` · `error-state-check-key` · `error-state-dismiss` · `error-state-hint`.

#### 3.9.2 `ConnectionBadge` — chip trạng thái kết nối

- **Vị trí:** trong `PanelHeader`, cạnh chip provider.
- **4 trạng thái:** `Đang kết nối` (đang probe lần đầu) · `Đã kết nối` · `Offline` (không gọi được BFF) · `Máy chủ lỗi` (BFF trả `degraded`).
- **DP-6:** **icon + chữ**, **không** chỉ dựa vào màu. Icon `lucide-react`: `Loader` (đang kết nối) · `Check` (đã kết nối) · `WifiOff` (offline) · `TriangleAlert` (lỗi server).
- **Token:** `--text-secondary` · `--color-danger` (offline) · `--color-warning` (degraded) · `--surface-sunken` · `--radius-full` · `--font-size-xs`. **Không hardcode màu.**

> `data-testid`: `connection-badge` · `loading-state` · `loading-state-row` · `empty-state`.

#### 3.9.3 Banner offline

- **Vị trí:** ngay dưới `PanelHeader`, **phía trên** thread.
- **Nội dung:** "Không kết nối được máy chủ. Đang thử lại..." + nút "Thử lại" (probe lại ngay). **Không** tự ẩn — lỗi kết nối là trạng thái kéo dài, không phải toast 5 s.
- **A11y:** `role="status"` + `aria-live="polite"` · focus ring rõ.

> `data-testid`: `offline-banner` · `offline-banner-retry`.

### 3.10 Request-id chip trong dòng meta của message (đã implement T-M1-14)

- **Vị trí:** dòng meta của bubble **assistant**, ngay sau chip `provider · model` và sau số token — cùng slot với chip provider/model (trust-by-transparency).
- **Nội dung:** **6 ký tự đầu** của `requestId` (ví dụ `a1b2c3`) — chỉ phần đủ để **đối chiếu** với dòng log trong DB (`GET /api/logs`).
- **Tooltip:** `title="Request ID: {full requestId}"` → hover hiện id đầy đủ (copy/paste được khi báo lỗi).
- **Font:** `font-mono` để phân biệt với model name; **cỡ chữ `--font-size-xs`**, màu `--text-tertiary` (cùng cấp độ thị giác với dòng token).
- **Token:** `--text-tertiary` · `--font-size-xs`. **Không hardcode màu.**
- **Điều kiện hiện:** chỉ hiện khi `message.requestId` khác `undefined` (message do server trả `meta.requestId`; message user / message local chưa gửi → không hiện).
- **Không phải badge nổi bật:** đây là **chi tiết kỹ thuật phụ trợ**, không phải thông tin hành động → không dùng `--color-accent`, không nền đậm (tránh cạnh tranh chú ý với nội dung).
- **A11y:** nằm trong text thuần của dòng meta → được đọc bởi screen reader như một đoạn text; không cần `aria-label` riêng. Id đầy đủ nằm trong `title` (đọc được qua tooltip).

> **Liên quan:** `UsageBadge` (hiển thị token in/out + cost) vẫn là **T-M2-03** — T-M1-14 chỉ hiện **request-id**, **không** hiện cost lên UI (cost đã có trong DB + SSE `usage`).

---

### 3.11 i18n VI/EN (đã implement T-M1-17)

- **Không có component UI mới** — task này **chỉ thay chuỗi literal** bằng `t('key')`.
- **Nguồn sự thật:** `apps/extension/src/i18n/vi.ts` (`viDictionary` là `const` object → `TranslationKey = keyof typeof viDictionary`). `apps/extension/src/i18n/en.ts` khai báo `Dictionary = Record<TranslationKey, string>` → **thiếu/thừa key là lỗi `pnpm typecheck`**, không cần test runtime để bắt.
- **Cơ chế:** `I18nProvider` (bọc ở `App.tsx`) → `useI18n()` trả `{ t, language }`. Component **không** nhận `t` qua props → không phải sửa call-site khi thêm key.
- **Đổi ngôn ngữ áp dụng ngay** (không reload): `useSettings()` nâng lên `App.tsx` → `settings.uiLanguage` → `I18nProvider` → `useMemo` tạo `t` mới (identity mới) → re-render toàn bộ cây.
- **Placeholder:** `{name}` — `formatMessage()` thay thế; thiếu tham số → giữ nguyên `{name}` (không vỡ UI).
- **Không thêm thư viện i18n** (không `i18next` / `intl-messageformat`) → giữ bundle nhỏ, không dependency mới.
- **A11y:** mọi chuỗi động đi qua `aria-label` / `title` cũng phải dịch (VD `aria-label="Gửi câu hỏi"` → `t('composer.send')`).
- **Ngoài panel:** context menu extension (2 mục) + nút nổi content script cũng dịch theo → nhãn đổi **không cần reload trình duyệt**.

> **Không dịch:** gợi ý trang trong `packages/shared/src/pageProfile.ts` + `SUMMARY_PROMPT` (phải nhất quán cho eval) · thông điệp lỗi trả về từ server (thuộc phía BFF).

> **Liên quan:** [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.17 · [`REQUIREMENTS.md`](REQUIREMENTS.md) §4.8.1 (FR-SETTINGS-06)

---

### 3.12 Menu xuất cuộc trò chuyện (đã implement T-M1-13)

Component `ExportMenu` — menu **3 mục** trong header panel (FR-CHAT-10).

- **Vị trí:** header panel, icon-button `Download` (`aria-label` = `t('chat.export')`, `data-testid="export-button"`), đặt **trước** nút "Xoá cuộc trò chuyện".
- **Điều kiện hiện:** **chỉ khi thread có nội dung** (`messages.length > 0`) → không mở menu rỗng.
- **Dạng menu:** Radix `Popover` (`components/ui/popover.tsx` — đã có sẵn) → render qua Portal → **không** bị `overflow` của thread cắt.
- **3 mục (theo thứ tự):**

| Mục | Icon | Hành động | `data-testid` |
|---|---|---|---|
| Sao chép Markdown | `ClipboardCopy` | `navigator.clipboard.writeText(markdown)` | `export-copy-markdown` |
| Xuất tệp .md | `FileText` | download `.md` | `export-download-markdown` |
| Xuất tệp .json | `FileJson` | download `.json` | `export-download-json` |

- **Style mục menu:** button phẳng, icon `h-3.5 w-3.5` + text `--font-size-sm` + `--text-primary` · hover nền `--surface-sunken` · focus ring chuẩn `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]`.
- **Token:** `--surface-sunken` · `--text-primary` · `--radius-sm` · `--space-1/2`. **Không hardcode màu.**
- **Feedback:** toast `sonner` — `toast.exportCopied` / `toast.exportDone` / `toast.exportFailed`.
- **Chỉ xuất đường đi active** — dữ liệu lấy từ `activePathMessages(messages, path)` (T-M1-10) → đúng nội dung user đang nhìn thấy.
- **`PanelHeader` nhận prop `exportMenu?: ReactNode`** (không phải callback) → header chỉ lo vị trí, không cần biết chi tiết hành động.
- **A11y:** trigger có `aria-label` tiếng Việt (`t('chat.export')`) · mỗi mục là `<button type="button">` (focus được bằng Tab) · focus ring theo token `--border-focus`.

> **Chi tiết hợp đồng file:** [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.20

---

## 4. State & hành vi UI chuẩn hoá

| Trạng thái | Yêu cầu UI | FR |
|---|---|---|
| **Loading khung** | Skeleton cho thread (`LoadingState`). Không spinner che toàn màn hình | NFR-PERF-03, FR-CHAT-14 |
| **Streaming** | Token hiện dần, con trỏ nhấp nháy, không layout shift | FR-CHAT-01, DP-4 |
| **Empty (chưa có chat)** | `PromptGallery`: ≥ 3 gợi ý theo loại trang + nút refresh (xoay vòng) + nút "Tóm tắt trang này" + dòng "Sẽ tự đính kèm trang này khi bạn chọn gợi ý" | FR-UX-03, FR-UX-04 |
| **Empty (chưa có context)** | Gợi ý câu hỏi chung (`generalSuggestions()`), **không** hiện nút tóm tắt | FR-UX-04 |
| **Error network / 5xx** | Inline trong thread (`ErrorState`) + nút "Thử lại" + nguyên nhân cụ thể | FR-CHAT-14 |
| **Error 401 (key)** | `ErrorState` → nút **"Kiểm tra API key"** mở drawer Settings (không có nút Retry) | FR-CHAT-14 |
| **Error 429** | `ErrorState` → đếm ngược giây rồi cho thử lại (nút disabled tới hết đếm) | FR-CHAT-14 |
| **BFF offline** | `ConnectionBadge` "Offline" ở header + banner dưới header + nút "Thử lại" | NFR-REL-04, FR-UX-08 |
| **BFF degraded** | `ConnectionBadge` "Máy chủ lỗi" ở header (icon + chữ) | NFR-REL-04 |
| **Quota đầy** | Badge cảnh báo + link quản lý quota | FR-PROVIDER-06 |
| **Offline (không mạng)** | Badge trạng thái + gợi ý dùng Ollama local | FR-PROVIDER-07 |
| **Đang chờ xác nhận** (M4) | Workflow dừng ở bước, hiện diff + Phê duyệt/Từ chối | FR-WORKFLOW-07 |
| **Context không đọc được** (PDF scan / `file://`) | Chip context báo lỗi rõ + hướng dẫn "hãy upload ảnh"; **không** block chat | FR-CONTEXT-05 |
| **Transcript không có** (YouTube không caption / geo-block) | Chip context báo "không lấy được transcript" + gợi ý dùng mô tả video; **không** block chat | FR-CONTEXT-06 |
| **Context vượt ngân sách** | Badge "đã dùng X/Y token" + liên kết xem phần bị cắt bớt | FR-CONTEXT-07 |
| **Không đính kèm gì (chat thuần LLM)** | Chip "Context" ở trạng thái TẮT · không có chip nguồn · **không** hiện meter · gợi ý "Thêm trang này" nếu user hỏi về trang đang xem | FR-CONTEXT-13 |

---

## 5. Accessibility checklist (WCAG 2.2 AA)

> **Trạng thái T-M1-20 (2026-11-08):** các mục dưới đây đã **được kiểm chứng bằng test** (`apps/extension/tests/a11y.test.tsx` + `apps/extension/e2e/responsive.spec.ts`) trừ khi còn ghi "T-M3-03".

- [x] Focus ring rõ ở mọi interactive element; **không** dùng `outline: none` mà không thay thế — ✅ **T-M1-20**: chuẩn hoá 12 chỗ về `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]`; unit test quét source đảm bảo **không còn** `focus-visible:outline-none` trần ở `src/sidepanel` + `src/components/ui`
- [x] Mọi icon-button có `aria-label` (tiếng Việt) — ✅ **T-M1-20**: unit test assert `PanelHeader` + `ContextChips`; mọi nút đóng Dialog dùng `t('common.close')`
- [x] Streaming dùng `aria-live="polite"` ở cấp **đoạn**, không theo từng token — ✅ **T-M1-20**: `MessageContent` có `role="article"` + `aria-live="polite"` + `aria-atomic="false"` + `aria-relevant="additions text"` **chỉ khi** đang stream; thread (`role="log"`) **không** đặt `aria-live` → không đọc lại lịch sử cũ
- [x] Skip-link "Bỏ qua tới ô nhập" — ✅ **T-M1-20**: `<SkipLink />` trong `App.tsx` → anchor `#sidekick-composer-input`, `sr-only focus:not-sr-only`
- [x] Popover/Dialog đóng bằng `Esc`, trả focus về trigger, focus bị kẹt bên trong khi mở — Radix `Dialog` / `Popover` xử lý sẵn (`focus trap` + `Escape` + `onCloseAutoFocus`)
- [x] `prefers-reduced-motion` được tôn trọng — ✅ **T-M1-20**: `@media (prefers-reduced-motion: reduce)` trong `index.css` tắt toàn bộ animation (`animate-drawer-in` · `animate-drawer-in-right` · `animate-fade-in`); animation chỉ dùng `opacity`/`transform` → không gây layout shift
- [x] Target size ≥ 24×24px (khuyến nghị 44×44) — ✅ **T-M1-20** cho ngưỡng **24px** (44×44 còn ở T-M3-03): mọi icon-button ≥ `h-6 w-6`; chip/nút nhỏ ≥ `min-h-[24px]`; unit test quét source đảm bảo icon-only button có class kích thước
- [x] Không dùng màu là tín hiệu duy nhất (trạng thái có icon + text) — ✅ đã có từ M0/T-M1-19 (`ContextBudget` dùng `--success`/`--warning`/`--danger` **kèm** text)
- [x] Form control có `<label>` liên kết, không chỉ placeholder — ✅ `Composer` (`aria-label={t('composer.inputLabel')}`) · `Input` trong `ConversationList` (`aria-label={t('conversation.searchLabel')}`) · `EndpointSettings` · `DataSettings`

> **Còn lại cho T-M3-03 (Polish):** đối chiếu tương phản thực tế ở **cả** light + dark theme (NFR-A11Y-02) — cần công cụ đo tương phản, không làm được bằng unit test jsdom.

### 5.1 Quy ước a11y bắt buộc khi viết component (T-M1-20)

| Quy tắc | Pattern | Lý do |
|---|---|---|
| Focus ring | `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]` | 1 token, đồng bộ `Button`/`Input`/`Textarea`; tránh 2 vòng focus chồng |
| Icon-button | `h-6 w-6` + `flex items-center justify-center` + `aria-label` | ≥ 24px (WCAG 2.2 §2.5.8) |
| Icon trang trí | `aria-hidden="true"` trên mọi icon lucide | Screen reader không đọc icon |
| Live region streaming | Chỉ trên **phần vừa stream**, `aria-atomic="false"` | Không spam từng token (NFR-A11Y-05) |
| Bề rộng cứng | `max-w-[min(Xpx,100%)]` thay vì `max-w-[Xpx]` | Co theo container ở 320px |
| Flex child | `min-w-0` + `truncate` | Không phình ngang |

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
| `PromptGallery`, `SummarizeButton` | FR-UX-03/04 | Parity với Edge Copilot (A4/A5) · Chrome Gemini (B9) |
| `Composer` | FR-CHAT-12/13 | Rubric R4 (instruction following) |
| **Không có component mới** — T-M1-03 chỉ thêm context menu + phím tắt ở tầng browser | FR-UX-01 | Parity A1 / A25 / B1 / B19 |
| `ErrorState` | FR-CHAT-14, FR-UX-08 | Độ ổn định, khó đo · rubric R6 (thông báo lỗi có nút khôi phục) |
| `ConnectionBadge` | NFR-REL-04 | Rubric R6 (người dùng biết BFF còn sống không) |
| `LoadingState`, `EmptyState` | NFR-PERF-03, FR-UX-03/04 | Rubric R6 (không màn hình trắng) |
| `ThemeSettings`, `AppearanceSettings` | FR-SETTINGS-01/02, FR-UX-06 | WCAG · parity theme (A24 / B12) |
| `PrivacySettings` | FR-SETTINGS-04, FR-CONTEXT-08 | R7 privacy transparency |
| `DataSettings` | FR-SETTINGS-03/07, NFR-SEC-07 | R7 privacy · WCAG |
| `EndpointSettings` | FR-SETTINGS-05 | Self-host / dev |
| `LanguageSettings` | FR-SETTINGS-06 | Parity i18n (B14) |
| `SettingsDrawer` | FR-SETTINGS-01..07, FR-UX-06 | Rubric R6 (UX) · parity drawer |
| `Onboarding` | FR-UX-02 | Parity 3 bước lần đầu |
| `AttachmentTray`, ảnh trong `MessageBubble` | FR-VISION-01 | Đối chiếu B17 (Gemini upload ảnh) |
| `UsageBadge`, `ProviderBadge` | FR-PROVIDER-05/09 | Bảng 3 "năng lực hệ thống" |
| Request-id chip trong dòng meta của `MessageBubble` | NFR-MAINT-04, FR-CONTEXT-12 | Minh bạch kỹ thuật · hỗ trợ điều tra lỗi khi chấm eval |
| **Không có component mới** — i18n chỉ thay chuỗi literal bằng `t('key')` | FR-SETTINGS-06 | Parity i18n (B14) — đổi ngôn ngữ **ngay**, không reload |
| `SkipLink` + focus ring chuẩn hoá + live region streaming + tap target 24px | FR-UX-07/09, NFR-A11Y-03/04/05 | Rubric R6 (UX) · WCAG 2.2 AA |

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
