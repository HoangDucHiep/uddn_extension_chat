# CHANGELOG — Tài liệu & triển khai

> Ghi lại **mọi thay đổi** trong repo, từ mới → cũ.
> Agent mới đọc 20 dòng đầu là nắm được gần đây đã làm gì.
> Format xem `.cursor/rules/docs-sync.mdc` §2.

---

## [Unreleased]

### Added
- **Docs — Audit traceability FR ↔ Task (2026-11-04)** — rà soát toàn bộ `docs/` đối chiếu `REQUIREMENTS.md` với `IMPLEMENTATION_PLAN.md`; phát hiện **31 FR + 27 NFR (58 yêu cầu)** chưa được map tới task nào trong cột FR của plan, cộng 2 nhãn FR sai. Đã bổ sung task + bảng traceability đầy đủ.
  - **`docs/REQUIREMENTS.md` §11.1** — bảng **FR ↔ Task** đầy đủ cho toàn bộ **83 FR + 29 NFR** (112 yêu cầu), chia theo nhóm (FR-CHAT / FR-CONTEXT / FR-VISION / FR-TOOLS / FR-SKILL / FR-PROVIDER / FR-WORKFLOW / FR-SETTINGS / FR-UX / NFR-PERF / NFR-SEC / NFR-REL / NFR-A11Y / NFR-MAINT), kèm cột Priority và Milestone.
  - **`docs/IMPLEMENTATION_PLAN.md` §3.2** — bảng rút gọn FR → Task theo nhóm (để audit nhanh khi sửa plan) + ghi nhận kết quả audit.
  - **Task card mới trong M1** (M1: 20 → 25 task):
    - `T-M1-21` — Trích xuất PDF (text-based) (FR-CONTEXT-05)
    - `T-M1-22` — Transcript YouTube (FR-CONTEXT-06)
    - `T-M1-23` — Ngân sách context & cắt bớt thông minh (FR-CONTEXT-07)
    - `T-M1-24` — Upload ảnh (paste / drag-drop / file picker) (FR-VISION-01)
    - `T-M1-25` — Onboarding lần đầu 3 bước (FR-UX-02)
  - **Task card mới trong M2** (M2: 18 → 22 task): `T-M2-19` chính sách context theo domain + lịch sử duyệt opt-in + mode "chỉ dùng trang" (FR-CONTEXT-08/09/11, FR-SETTINGS-04, NFR-SEC-02/06) · `T-M2-20` web search tool (FR-TOOLS-03) · `T-M2-21` skill library built-in + skill gắn điều kiện (FR-SKILL-04/06) · `T-M2-22` vision mở rộng (FR-VISION-02/03/04/05).
  - **Task card mới trong M3** (M3: 9 → 11 task): `T-M3-10` backup DB tự động (`pg_dump` cron) (NFR-REL-05) · `T-M3-11` bộ ADR (NFR-MAINT-05).
  - **`docs/SYSTEM_DESIGN.md` §7.3.1** — thiết kế nhánh trích xuất PDF & YouTube: content script không đủ (PDF viewer là plugin native, transcript nằm ở `captionTracks`) → cả 2 nhánh fetch ở BFF rồi chuẩn hoá về cùng shape `context.text`; kèm quy tắc bảo mật (chống SSRF: chặn mạng nội bộ, giới hạn kích thước, timeout) và nguyên tắc "lỗi trích xuất không được làm hỏng chat". Thêm 2 endpoint đích `POST /api/extract/pdf` · `POST /api/extract/youtube` vào §4.1.

### Changed
- **`docs/REQUIREMENTS.md` §4.2** — `FR-CONTEXT-05` (PDF) và `FR-CONTEXT-06` (transcript YouTube) **nâng từ Should → Must**. Lý do: Edge Copilot (A20) và Chrome Gemini (B10) đều có ở mức Must để đạt parity; đây là 2 dòng "Must" mới trong gate M1. Bổ sung AC chi tiết cho cả 2 (PDF scan → báo "không đọc được, hãy upload ảnh"; PDF nội bộ/`file://` → báo rõ; YouTube không có caption / geo-block / consent → báo rõ).
- **`docs/REQUIREMENTS.md` §6.3** — dòng ràng buộc "Content script không chạy trên PDF viewer" được sửa thành cách xử lý thật (BFF fetch bytes + parse server-side) thay vì "mở PDF bằng viewer ngoài".
- **`docs/IMPLEMENTATION_PLAN.md`** — sửa nhãn FR sai: `T-M1-04` (`FR-CONTEXT-02/09` → `FR-CONTEXT-02`; `FR-CONTEXT-09` thực chất là lịch sử duyệt web, thuộc `T-M2-19`) · `T-M1-06` (`FR-CONTEXT-01/05` → `FR-CONTEXT-01/02/03/07`; nhãn cũ nhầm sang PDF). Bổ sung FR/NFR vào các task card cũ: `T-M0-02` (+NFR-SEC-08) · `T-M0-06` (+NFR-SEC-05) · `T-M0-07` (+NFR-MAINT-03) · `T-M0-11` (+NFR-PERF-06) · `T-M0-12` (+NFR-SEC-03) · `T-M1-01` (+NFR-PERF-04) · `T-M1-07` (+NFR-SEC-04, NFR-PERF-02) · `T-M1-09` (+FR-CHAT-08/11) · `T-M1-10` (+FR-CHAT-07/12, FR-UX-05) · `T-M1-12` (+FR-SETTINGS-03/04/05/07, NFR-SEC-07) · `T-M1-14` (+FR-CONTEXT-12, NFR-REL-01) · `T-M1-15/16` (+NFR-SEC-01) · `T-M1-19` (+FR-UX-08, NFR-REL-02/04) · `T-M1-20` (+FR-UX-07/09/10, NFR-PERF-03, NFR-A11Y-01..05) · `T-M1-03/18` (bỏ nhầm FR-UX-02) · `T-M2-01` (+FR-PROVIDER-07) · `T-M2-04/07` (+NFR-MAINT-03) · `T-M2-13` (+NFR-MAINT-02) · `T-M3-02` (+NFR-PERF-05) · `T-M3-03` (+NFR-MAINT-02) · `T-M3-04` (+FR-UX-10, NFR-PERF-02) · `T-M3-09` (+NFR-PERF-06) · `T-M4-02..08` (bổ sung FR-WORKFLOW-06/08/09/10/11/12/13). §8 timeline thêm tuần W5.5 · §10 thứ tự cắt thêm 4 mục + đánh dấu T-M1-21/22/23/24/25 là **không được cắt**.
- **`docs/COMPARISON_MATRIX.md`** — `A20` (Edge: tóm tắt video/PDF) và `B10` (Gemini: tóm tắt video YouTube) đổi ưu tiên `S` → `M`; §D thêm hàng "Context PDF / video (transcript)"; §E checklist parity thêm 4 dòng (PDF, YouTube, ngân sách context, upload ảnh).
- **`docs/SYSTEM_DESIGN.md`** — §3 cây thư mục bổ sung `lib/contextBudget.ts` + `routes/extract.ts` + `lib/{pdfExtractor,youtubeExtractor}.ts`; §8 thêm 2 dòng ngân sách trích xuất PDF/YouTube; §9 thêm 2 rủi ro (SSRF qua fetch URL, YouTube không có caption).
- **`docs/DESIGN_SYSTEM_BRIEF.md`** — thêm component `ContextBudget` (§3.4) + sửa nhãn `ContextChips` (`FR-CONTEXT-09` → `FR-CONTEXT-02`); §4 thêm 3 state mới: "Context không đọc được" (PDF scan / `file://`), "Transcript không có" (YouTube), "Context vượt ngân sách"; §6 bổ sung mapping `Onboarding` (FR-UX-02) + `AttachmentTray`/`AttachmentChip` (FR-VISION-01).
- **`docs/EVAL_PLAN.md`** — thêm 2 nhóm task `doc_extract` (PDF, 2 task) + `video_transcript` (YouTube, 2 task) → dataset 44 → 48 task; §12 checklist thêm dòng kiểm tra 2 nhóm này.
- **`docs/README.md`** — cập nhật số FR/NFR (82/30) + số task (82) + phiên bản docs v1.1 + trạng thái milestone (M0 ✅ xong, M1 1/25 task).
- **`AGENTS.md`** — cập nhật §6: M1 còn 1/25 task (thay vì 1/20).
- **`docs/HANDOFF.md`** — ghi nhận quyết định nâng PDF/YouTube lên Must + kết quả audit.

### Fixed
- **Nhãn FR sai trong `IMPLEMENTATION_PLAN.md`** — `T-M1-04` ghi `FR-CONTEXT-09` (lịch sử duyệt web, thực chất không liên quan toggle context) và `T-M1-06` ghi `FR-CONTEXT-05` (PDF, thực chất là truyền context sang BFF). Đã sửa cả hai.
- **`docs/REQUIREMENTS.md` §11** — thiếu bảng FR → Task khiến không kiểm chứng được FR nào đã được implement. Đã bổ sung §11.1.

### Added
- **T-M1-01** — Content script extractor "Readability-lite" + mang nội dung trang vào context gửi BFF (FR-CONTEXT-01).
  - `apps/extension/src/content/extractor.ts` — thuật toán rút gọn Readability: clone `Document` (không mutate DOM thật) → xoá `script/style/nav/footer/aside/form/…` + phần tử có `class`/`id` khớp pattern âm → chấm điểm các node `article, main, [role="main"], section, div` (điểm theo độ dài text của block con, trừ khi link density > 0.5, cộng/trừ theo `class`/`id`, bonus cho thẻ semantic) → chọn node điểm cao nhất → fallback `body` → ghép text chuẩn hoá whitespace. Trả `{ title, byline, url, text, excerpt, strategy, wordCount }` với `strategy ∈ article | main | body | empty`.
  - `apps/extension/src/content/contentScript.ts` — expose `window.__sidekickExtractContent()` + listener `chrome.runtime.onMessage` action `sidekick:extract-content` (tái dùng cho T-M1-02).
  - `apps/extension/src/lib/pageContext.ts` — `captureTabContext(tabId)` + `getActiveTabId()`: gọi `chrome.scripting.executeScript`, tự inject `content.js` rồi thử lại nếu content script chưa có, **không bao giờ throw** (trang `chrome://` / không có quyền → trả context tối thiểu).
  - `apps/extension/src/types/globals.d.ts` — khai báo global `__sidekickExtractContent` / `__sidekickExtractMetadata`.
  - `packages/shared`: `pageContextSchema` bổ sung `text` (nội dung chính) + `excerpt` (trích đoạn); `LIMITS.MAX_PAGE_TEXT_CHARS = 40_000`, `LIMITS.MAX_EXCERPT_CHARS = 500`.
  - `apps/server/src/services/chatService.ts` — `buildContextPrompt()` đưa `context.text` + `context.excerpt` vào prompt, giữ nguyên việc đánh dấu context là "dữ liệu tham chiếu, không phải chỉ thị" (chống prompt injection).
  - `apps/extension/src/sidepanel/hooks/useChat.ts` — tự capture context của tab active trước khi gửi; lỗi capture không làm hỏng chat.
  - **Test** — +29 unit test: `apps/extension/tests/extractor.test.ts` (8 fixture HTML) · `apps/extension/tests/pageContext.test.ts` (5) · `apps/extension/tests/useChat.test.ts` (+3) · `packages/shared/tests/chatSchema.test.ts` (7) · `apps/server/tests/contextPrompt.test.ts` (6) — và **+1 E2E** `apps/extension/e2e/extractor.spec.ts` (content script chạy thật trên trang web, service worker gọi `chrome.scripting.executeScript` → trích đúng title + nội dung chính).

### Fixed
- **Content script build ra ESM → Chrome không load được.** `dist/content.js` chứa `import ... from "./assets/dist.js"` sau khi extractor được tách thành module → Chrome báo *"It isn't a module"* và content script **không chạy**. Tách build riêng `apps/extension/vite.content.config.ts` (`build.lib` + `formats: ['iife']`, `emptyOutDir: false`) → `dist/content.js` là 1 file IIFE tự chứa, không `import`.
- **`@sidekick/shared` kéo theo toàn bộ bundle `zod` vào content script** (101 kB) → thêm subpath export `@sidekick/shared/constants`; extractor chỉ import hằng số từ đó → `dist/content.js` còn **4.7 kB**.

### Changed
- `apps/extension/package.json`: `build` giờ chạy 2 lần (`vite build` + `vite build --config vite.content.config.ts`); thêm script `build:content`.
- `packages/shared/package.json`: thêm export map `"./constants"`.
- `apps/extension/tests/setup.ts`: mock `chrome.tabs.get` / `chrome.tabs.query` / `chrome.scripting.executeScript` với chữ ký đúng để `vi.mocked()` giữ type.
- `docs/IMPLEMENTATION_PLAN.md`: thêm cột **Status** cho bảng task M1 (T-M1-01 ✅) + mục **§3.1 Kết quả verify T-M1-01**.
- `docs/SYSTEM_DESIGN.md`: §3 cây thư mục cập nhật (có `content/extractor.ts` + `lib/pageContext.ts` + `vite.content.config.ts`); §4.2 thêm **shape `ChatRequest` đang chạy thật** (khung đích M2+ giữ nguyên); §7.2 số test + **§7.3** luồng trích xuất nội dung trang + **§7.4** quy tắc build content script (IIFE); §8 ghi rõ cache `chrome.storage.local` chưa implement.
- `docs/REQUIREMENTS.md`: FR-CONTEXT-01 ghi chú trạng thái đã implement; §6.5 cây thư mục cập nhật.
- `docs/COMPARISON_MATRIX.md`: §E checklist parity gắn trạng thái + task ID tương ứng.
- `docs/HANDOFF.md`: milestone hiện tại M1 · task kế tiếp **T-M1-02**.
- Số test toàn repo: **120 unit** (shared 22 · server 55 · extension 43) + **3 E2E**.

### Added
- **T-M0-01 → T-M0-15** — Milestone M0 (Foundation) hoàn thành, đạt toàn bộ gate verify (xem `docs/IMPLEMENTATION_PLAN.md` §2.1).
  - **T-M0-01/02** — Monorepo pnpm workspace (`apps/extension`, `apps/server`, `apps/eval`, `packages/shared`), ESLint 10 + Prettier + TS strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
  - **T-M0-03** — `packages/shared`: Zod schemas, union 8 SSE event, error codes chuẩn, entity types.
  - **T-M0-04/05** — Docker Compose Postgres 16 + `pgvector/pgvector:pg16`, Drizzle schema 6 bảng (`conversations`, `messages`, `citations`, `tool_calls`, `provider_keys`, `request_logs`), migration `0000_adorable_sister_grimm.sql`.
  - **T-M0-06** — BFF Express 5: `/api/health`, error middleware, origin guard, request logger, `.env` loader có validate bằng Zod.
  - **T-M0-07/08/09** — Provider layer: `MockProvider` + adapter Groq / OpenRouter / Gemini Direct, registry có fallback chain, `keyResolver` hỗ trợ K1 (env) / K2 (BYOK mã hoá) / K3 (local), `crypto.ts` dùng AES-256-GCM.
  - **T-M0-10** — `POST /api/chat` trả SSE 8 event (`meta` → `token`* → `citation`/`tool_call`/`tool_result` → `usage` → `done`), ghi `messages` + `request_logs`, hỗ trợ abort.
  - **T-M0-11/12/13/14** — Extension MV3: Vite 8 + React 18 + Tailwind v4 + shadcn/ui, `manifest.json` (`side_panel`, `scripting`, `storage`, `tabs`, `contextMenus`, `<all_urls>`, CSP `script-src 'self'`), 4 icon PNG, `sseClient` đọc `ReadableStream` trực tiếp từ BFF, `useChat` hook + Zustand store, design token `design/tokens.json` → `design/tokens.css` (light/dark, WCAG 2.2 AA).
  - **T-M0-15** — `apps/eval` scaffold (dataset loader + CLI + `tsconfig.json`).
- **Test** — 91 unit test (shared 15 · server 49 · extension 27) + 2 E2E Playwright (`apps/extension/e2e/sidepanel.spec.ts`): load unpacked, render header/composer, gõ prompt nhận token thật từ BFF, provider chip hiển thị, design token apply.
- **`scripts/verify-providers.mjs`** — script verify 3 provider stream thật (Groq / OpenRouter / Gemini Direct) + `scripts/generate-icons.mjs` sinh icon PNG từ SVG.

### Changed
- `docs/IMPLEMENTATION_PLAN.md`: thêm cột **Status** cho bảng task M0 (tất cả ✅) + mục **§2.1 Kết quả verify M0** với bằng chứng từng gate.
- `apps/server/src/middleware/origin.ts`: hỗ trợ wildcard theo scheme (`chrome-extension://*`) — id extension load unpacked đổi theo máy nên không thể hardcode origin.
- `apps/server/.env.example`: `ALLOWED_ORIGINS` thêm `chrome-extension://*`.
- `docs/SYSTEM_DESIGN.md`, `docs/REQUIREMENTS.md`, `docs/DESIGN_SYSTEM_BRIEF.md`, `docs/README.md`, `AGENTS.md`: đồng bộ với trạng thái M0 đã implement.
- `docs/REQUIREMENTS.md`:
  - §1.6 bổ sung stack đã chốt (React + Tailwind + shadcn/ui, Drizzle, monorepo pnpm) và đổi mốc hạn chót thành "M2 = EVAL_REPORT bắt buộc, M3 = polish + nộp, M4 = workflow tuỳ chọn".
  - §2 parity summary: thêm dòng "3 nguồn API key (K1/K2/K3)" và "Workflow automation (M4, sau cùng)"; đổi mức ưu tiên của Image gen / Voice / Vision từ "M2" sang "C".
  - §6.5 cấu trúc thư mục: cập nhật sang monorepo pnpm (`apps/extension`, `apps/server`, `apps/eval`, `packages/shared`).
  - §7.2 schema: thêm bảng `eval_datasets` và `eval_judgments`.
  - §11 Traceability: bổ sung dòng cho Design System / System Design / Implementation Plan.
  - Header: cập nhật status + danh sách docs liên quan.
- `docs/COMPARISON_MATRIX.md`:
  - §0 bổ sung 3 nguồn: Copilot Actions in Edge (A27), Gemini Tasks (B28), Gemini Schedules (B28).
  - §D: thêm chú thích giải thích thứ tự ưu tiên và vị trí M4 của workflow.
- `docs/EVAL_PLAN.md`:
  - §10: ghi rõ Eval thuộc M2 và là deliverable bắt buộc; nhóm `workflow` chỉ chạy ở M4.
  - §12: thêm 2 checklist item (bỏ nhóm workflow nếu chưa có M4; giữ `EVAL_REPORT.md` trong git).
  - §7: đổi toàn bộ đường dẫn `eval/…` → `apps/eval/…` và lệnh `npm run eval:*` → `pnpm eval:*` cho khớp monorepo pnpm.

### Fixed
- **Extension gửi message assistant rỗng lên BFF** → BFF trả `VALIDATION_ERROR`. `useChat` giờ loại message có `content` rỗng khỏi lịch sử gửi đi.
- **`apiClient.fetchJson` crash** khi BFF/proxy trả body không phải JSON (ném `SyntaxError` thay vì `ApiError` chuẩn) → nay parse trong `try/catch`, fallback `INTERNAL_ERROR`.
- **Font trong side panel không áp dụng design token**: Chrome inject rule `font` cho `body` ở trang extension, đè lên `font-family`/`font-size`. Typography chuyển sang đặt trên `#root` (div) thay vì `body`.
- **`@theme inline` tự tham chiếu `var(--font-sans)`** trong `index.css` → vòng lặp CSS làm token rỗng. Bỏ `@theme`, import `design/tokens.css` sau `tailwindcss` để token ghi đè mặc định của Tailwind.
- **`sidepanel.html` build ra `dist/src/sidepanel/index.html`** (sai đường dẫn `side_panel.default_path`) → chuyển entry HTML ra `apps/extension/sidepanel.html` ở root project.
- **`pnpm eval:run` không chạy được**: `node --experimental-strip-types` không resolve được import `.js` trỏ tới file `.ts` → chuyển sang `tsx` (giống `apps/server`), và truyền đúng tên script từ root (`pnpm --filter @sidekick/eval run run`).
- Sửa 4 tham chiếu `§X.Y` sai phát sinh khi viết lại docs: `workflow-discipline.mdc` trỏ `SYSTEM_DESIGN.md` §6 → §5 (data model); `REQUIREMENTS.md` §11 traceability trỏ §5 (SSE) → §4 và §6 (schema) → §5; `IMPLEMENTATION_PLAN.md` T-M2-18 trỏ "theo §7" (DoD) → "theo §10" (kịch bản cắt); `docs-sync.mdc` bỏ mẫu link `](*.md)` gây báo động link chết giả.
- `docs/HANDOFF.md` — đếm số file docs 8 → 9 (thêm `SYSTEM_DESIGN.md` + `IMPLEMENTATION_PLAN.md`).
- `AGENTS.md` — cập nhật mô tả cấu trúc `docs/` (9 file).

### Docs
- Cập nhật `REQUIREMENTS.md` §6.5 + `SYSTEM_DESIGN.md` §3/§7 + `DESIGN_SYSTEM_BRIEF.md` §2 theo trạng thái implement thực tế.
- `docs/HANDOFF.md`: ghi nhận M0 hoàn tất, việc tiếp theo là M1 (parity).
- Kiểm tra toàn repo bằng script: **0 link chết**, **0 tham chiếu `§X.Y` không resolve** (quét 15 file `.md`/`.mdc`).
- **`docs/SYSTEM_DESIGN.md`** — kiến trúc chi tiết: 12 ADR, cấu trúc thư mục, hợp đồng API (30 endpoint), giao thức SSE (8 event type), data model Drizzle (17 bảng), chiến lược bảo mật, chiến lược test, rủi ro kỹ thuật.
- **`docs/IMPLEMENTATION_PLAN.md`** — kế hoạch task-level M0–M4 (71 task, có mã `T-Mx-xx`), Definition of Done, timeline 13 tuần, phân công 3 thành viên, kịch bản thiếu thời gian.
- **`docs/DESIGN_SYSTEM_BRIEF.md`** — viết lại (file từng bị mất): 7 design principles, design token inventory (color/typography/spacing/motion/layout), component inventory + chiến lược dùng lại vs tự viết, state & hành vi UI chuẩn hoá, checklist WCAG 2.2 AA, traceability component ↔ FR.
- **`docs/HANDOFF.md`** — quy trình bắt đầu chat mới (6 bước, ≤ 5 phút), mẹo tiết kiệm token, quy trình kết thúc phiên.
- **`docs/CHANGELOG.md`** — file này.
- **`AGENTS.md`** — entry point ngắn (<200 dòng) cho agent: stack, kiến trúc, lệnh, quy ước bắt buộc, trạng thái milestone.
- **`.cursor/rules/`** — 5 rule file: `project-overview.mdc`, `docs-sync.mdc`, `coding-standards.mdc`, `mv3-chrome.mdc`, `workflow-discipline.mdc`.
- **`.cursorrules`** — bản compact 20 dòng cho công cụ không đọc `.cursor/rules`.
- **`.gitignore`**, **`.editorconfig`**, **`.npmrc`**, **`.nvmrc`** — setup files cơ bản.

---

## [v0.1 — 2026-11-03] — Baseline tài liệu

### Added
- `docs/REQUIREMENTS.md` — 14 User Stories, 81 Functional Requirements, 29 Non-Functional Requirements, kiến trúc, schema DB, phân tích rủi ro, roadmap M0–M4.
- `docs/COMPARISON_MATRIX.md` — 28 tính năng Edge Copilot (A1–A28), 28 tính năng Chrome Gemini (B1–B28), 15 tính năng độc quyền (C1–C15), checklist parity M1 và M4.
- `docs/EVAL_PLAN.md` — chiến lược eval 2 tầng, dataset 44 task, rubric 8 tiêu chí, judge prompt, 11 fairness controls, 3 bảng kết quả, kế hoạch triển khai 4 tuần.
- `docs/README.md` — index tài liệu, thứ tự đọc, sơ đồ kiến trúc.

### Notes
- Xác định 3 nguồn API key: K1 (team key trong `.env`), K2 (BYOK mã hoá qua BFF trong Postgres), K3 (BYOK trực tiếp trong `chrome.storage.local` khi BFF down).
- Xác định các ràng buộc MV3: `activeTab` không dùng được trong side panel; `sidePanel.open()` chỉ trong user gesture; SW bị kill ~30s → streaming không đi qua SW.
