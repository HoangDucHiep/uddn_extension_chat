# HANDOFF — Bắt đầu chat mới

> Mục tiêu: chat mới nắm context trong **≤ 5 phút** mà không cần đọc lại toàn bộ `docs/`.

---

## 1. Checklist bắt đầu (làm theo thứ tự)

| # | Việc | Mất thời gian | Nếu thiếu |
|---|---|---|---|
| 1 | Đọc `AGENTS.md` (file gốc) | 2 phút | Nắm 80% context |
| 2 | Đọc `docs/HANDOFF.md` (file này) | 1 phút | Biết đang làm dở gì |
| 3 | Đọc `docs/CHANGELOG.md` — 20 dòng đầu | 30 giây | Biết gần đây đổi gì |
| 4 | `git log --oneline -10` + `git status` | 30 giây | Biết trạng thái repo |
| 5 | Nếu đang làm dở: mở file liên quan + `docs/IMPLEMENTATION_PLAN.md` § milestone tương ứng | 1 phút | Biết task tiếp theo |
| 6 | Nếu cần chi tiết kỹ thuật: mở `docs/SYSTEM_DESIGN.md` § liên quan | khi cần | — |

> **Không** cần đọc `REQUIREMENTS.md`, `EVAL_PLAN.md`, `COMPARISON_MATRIX.md` ngay — chỉ mở khi task chạm tới chúng.

---

## 2. Trạng thái hiện tại

| Hạng mục | Trạng thái |
|---|---|
| Docs | ✅ Đầy đủ 9 file (`docs/`) + `AGENTS.md` ở root |
| Code | ✅ M0 (Foundation) hoàn tất · **T-M1-01 xong** — 4 workspace, 120 unit test + 3 E2E |
| Git | ✅ Đã init (`main`) · tag `v0.1` đánh dấu M0 |
| Milestone hiện tại | **M1 — Parity** (M0 đã đóng, T-M1-01 xong) |
| Task tiếp theo | **T-M1-02** — content script selection context (FR-CONTEXT-04) |

### Đang làm dở

_(Không có — T-M1-01 đã commit, task kế tiếp T-M1-02)_

### Việc đã xong gần nhất (T-M1-01 — Content script extractor)

- **T-M1-01** — `apps/extension/src/content/extractor.ts`: Readability-lite (clone `Document` → xoá noise → chấm điểm node → fallback `body`), trả `{ title, byline, url, text, excerpt, strategy, wordCount }`.
- `apps/extension/src/lib/pageContext.ts`: `captureTabContext()` + `getActiveTabId()` qua `chrome.scripting`, tự inject `content.js` nếu chưa có, không throw.
- `packages/shared`: `pageContextSchema` có `text` + `excerpt`; `LIMITS.MAX_PAGE_TEXT_CHARS = 40_000`.
- `apps/server`: `buildContextPrompt()` đưa nội dung trang vào prompt (đánh dấu "dữ liệu, không phải chỉ thị").
- `useChat` tự capture context của tab active; lỗi capture không hỏng chat.
- +29 unit test + 1 E2E thật (`e2e/extractor.spec.ts`). Bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §3.1.
- **Sửa lỗi build content script:** bundle ra ESM → Chrome không load được → tách `vite.content.config.ts` (IIFE). Xem `docs/SYSTEM_DESIGN.md` §7.4.

### Việc đã xong trong phiên gần nhất (M0 — Foundation)

- **T-M0-01/02** — Monorepo pnpm workspace + ESLint/Prettier/TS strict. `pnpm install`, `pnpm typecheck`, `pnpm lint` đều pass.
- **T-M0-03** — `packages/shared`: Zod schema, union 8 SSE event, error codes.
- **T-M0-04/05** — Postgres 16 + pgvector 0.8.7 trong Docker (`sidekick-db`, healthy), Drizzle 6 bảng, migration `0000_adorable_sister_grimm.sql`.
- **T-M0-06** — BFF Express 5 (`/api/health`, error middleware, origin guard, request logger).
- **T-M0-07/08/09** — Provider layer: Mock + Groq + OpenRouter + Gemini Direct; keyResolver K1/K2/K3; AES-256-GCM.
- **T-M0-10** — `POST /api/chat` SSE 8 event + `request_logs` + abort.
- **T-M0-11/12/13/14** — Extension MV3: side panel React + Tailwind v4 + shadcn, manifest + 4 icon, `sseClient` đọc stream trực tiếp, `useChat` + Zustand, design tokens.
- **T-M0-15** — `apps/eval` scaffold (dataset loader + CLI).
- **Verify M0**: 3/3 provider stream thật · E2E side panel 2/2 pass · tag `v0.1`.
- Chi tiết bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §2.1.

### Quyết định đã chốt trong các phiên trước

| Quyết định | Lý do |
|---|---|
| Tailwind + shadcn/ui (copy code vào repo) | Sở hữu 100%, không phụ thuộc runtime, tự sửa sâu được |
| Drizzle ORM + PostgreSQL 16 | Type-safe, hỗ trợ `pgvector`, migration đọc được |
| Monorepo pnpm workspace | 1 nguồn type cho extension/server/eval |
| 3 nguồn API key: K1 / K2 / K3 | Demo nhanh + BYOK an toàn + fallback khi BFF down |
| BFF là bắt buộc (không bỏ) | Cần BYOK mã hoá, RAG, MCP, log cho eval |
| Streaming không qua service worker | MV3 SW bị kill ~30s |
| Workflow (M4) implement cuối cùng | Không nằm trong yêu cầu bắt buộc của thầy |
| Git local, chưa push | Theo quyết định ban đầu |
| Provider chain `groq → openrouter → gemini` | Groq nhanh + rẻ nhất; OpenRouter/Gemini làm fallback |
| `maxOutputTokens` mặc định 2048 | OpenRouter trả HTTP 402 nếu max token quá lớn |
| Gemini `thinkingConfig.thinkingBudget = 0` | Model Gemini 3.x dùng hết budget cho "thought", không trả text |
| Origin allowlist hỗ trợ `chrome-extension://*` | Id extension load unpacked đổi theo máy, không thể hardcode |
| Typography đặt trên `#root` (không phải `body`) | Chrome inject rule `font` cho `body` ở trang extension, đè lên design token |
| Extractor tự viết thay vì dùng `@mozilla/readability` | Không kéo thêm dependency lớn vào content script; thuật toán rút gọn đủ dùng cho blog/docs |
| `pageContextSchema` mở rộng ngay ở T-M1-01 (thêm `text`/`excerpt`) | Tránh sửa contract 2 lần (T-M1-01 + T-M1-06) |
| `captureTabContext()` không bao giờ throw | Trang `chrome://` / Web Store không đọc được → panel vẫn phải chat được |
| Content script build riêng thành IIFE | Chrome KHÔNG load được content script dạng ESM → tách `vite.content.config.ts` (`docs/SYSTEM_DESIGN.md` §7.4) |
| `@sidekick/shared` có subpath export `./constants` | Content script không cần kéo theo bundle `zod` (101 kB → 4.7 kB) |

---

## 3. Câu hỏi cần hỏi lại user

_(Ghi lại các câu hỏi chưa có câu trả lời, hoặc điều kiện đã thay đổi)_

- Hạn chót nộp bài cụ thể là ngày nào? (ảnh hưởng kịch bản cắt M4)
- Có nên push lên remote (GitHub) để backup không? (hiện tại chỉ git local)
- Ngôn ngữ chính của UI: tiếng Việt hay song ngữ ưu tiên?
- Có cần giữ `MockProvider` trong production build không, hay chỉ dùng cho test?

---

## 4. Mẹo để tiết kiệm token

| Cần biết | Đọc file |
|---|---|
| Dự án là gì, stack, lệnh | `AGENTS.md` |
| Task tiếp theo làm gì | `docs/IMPLEMENTATION_PLAN.md` § milestone hiện tại |
| API shape, schema DB | `docs/SYSTEM_DESIGN.md` §4–§5 |
| Component nào dùng, token nào | `docs/DESIGN_SYSTEM_BRIEF.md` §2–§3 |
| FR tương ứng | `docs/REQUIREMENTS.md` §4 (grep theo mã FR) |
| Ràng buộc MV3 | `.cursor/rules/mv3-chrome.mdc` |

**Mẹo:** dùng `Grep` với mã FR (`FR-CHAT-12`) thay vì đọc cả `REQUIREMENTS.md`.

---

## 5. Quy trình kết thúc phiên chat

Trước khi ngừng, **bắt buộc**:

1. Cập nhật §2 "Đang làm dở" + §3 "Câu hỏi cần hỏi lại user" ở file này.
2. Thêm entry vào `docs/CHANGELOG.md`.
3. `git add -A && git commit` — không để lại thay đổi chưa commit.
4. Nếu task dở → ghi rõ "tiếp tục từ đâu" trong §2.

---

## 6. Mẫu ghi chép

```markdown
### Đang làm dở
- **T-M1-01** — content script extractor: đã tạo `src/content/extractor.ts` với heuristic `<article>`.
  Còn thiếu: fallback cho trang không có `<article>`, và test với fixture HTML.
  Tiếp tục từ: thêm `tests/extractor.test.ts` với 3 fixture HTML.

### Quyết định mới trong phiên này
- Dùng `@tailwindcss/vite` plugin thay vì PostCSS config (nhanh hơn, ít file hơn).
```
