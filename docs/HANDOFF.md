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
| Code | ✅ M0 (Foundation) hoàn tất · **T-M1-01 + T-M1-21 + T-M1-22 + T-M1-23 + T-M1-04 xong** — 4 workspace, 229 unit test + 9 E2E |
| Git | ✅ Đã init (`main`) · tag `v0.1` đánh dấu M0 |
| Milestone hiện tại | **M1 — Parity** (M0 đã đóng, M1: **5/25 task**) |
| Task tiếp theo | **T-M1-05** — `@` multi-tab (nguồn item tier `attachment`) → T-M1-02 (selection, tier cao nhất) → T-M1-24 (upload file) |

### Đang làm dở

_(Không có — T-M1-23 đã commit, task kế tiếp T-M1-05)_

### Việc đã xong gần nhất (T-M1-23 — Ngân sách context & mô hình "đính kèm chủ động")

- **Contract** — `packages/shared/src/contextBudget.ts` (`estimateTokens` · `applyContextBudget` · `trimHistory`) + `schemas/chat.ts` (`contextItemSchema` · `contextBundleSchema` · `normalizeContext`) + `constants.ts` (`CONTEXT_WINDOWS` · `CONTEXT_SAFETY_MARGIN_TOKENS` · `MAX_CONTEXT_ITEMS`).
- **Server** — `buildContextPrompt()` render item theo tier với nhãn nguồn; `buildProviderMessages()` áp `applyContextBudget()` + `trimHistory()` → server cắt lại lần nữa (nguồn chân lý).
- **Extension** — `lib/contextAttach.ts` (`attachCurrentTab`) · `lib/storage.ts` (persist toggle) · `chatStore` (`attachedItems` · `contextEnabled` · `budget`) · `useChat` (`buildRequestContext`) · `ContextChips.tsx` · `ContextBudget.tsx` · `App.tsx` mount 2 component trên Composer.
- **Hành vi đổi (quan trọng):** context **không còn tự capture** tab active mỗi lượt. Không đính kèm gì → request **không** có payload `context` → chat thuần LLM (FR-CONTEXT-13).
- **Test** — +42 unit test (tổng 229) + **4 E2E mới** (`e2e/context.spec.ts`); `e2e/extract.spec.ts` cập nhật (phải bấm "Thêm trang này" trước khi trích xuất). Bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §3.1c.

### Quyết định kỹ thuật mới (T-M1-23)

| Quyết định | Lý do |
|---|---|
| Mô hình "đính kèm chủ động" (toggle context mặc định **TẮT**) thay vì "tự share tab active" | Đã chốt với user: cần có đường "chat như LLM thuần" + biểu diễn được nhiều nguồn theo thứ tự ưu tiên (FR-CONTEXT-07/13). Đánh đổi 1 điểm parity "tiện" lấy 1 điểm "minh bạch + riêng tư" — đã ghi trung thực trong `COMPARISON_MATRIX.md` §D/§E + `EVAL_PLAN.md` FC-12 |
| Logic ngân sách đặt ở `packages/shared` (`contextBudget.ts`), **dùng chung** client + server | Meter "đã dùng X/Y" không được lệch với cái thực sự gửi đi; server vẫn cắt lại (nguồn chân lý) |
| `context` đổi sang bundle `{ items: ContextItem[] }` có `tier` | Cần nhiều nguồn + thứ tự ưu tiên; `tier` là thứ tự cấp phát ngân sách (`selection` > `attachment` > `currentTab`) |
| `z.preprocess(normalizeContext, …)` — nhận cả shape cũ lẫn mới | Eval harness / client cũ không vỡ khi đổi contract |
| `estimateTokens` là heuristic `ceil(chars/4)`, không thêm dependency tokenizer | Không kéo thêm lib vào bundle; số token thật hiển thị từ `usage` event (T-M2-03). Docs ghi rõ là **xấp xỉ** |
| Đính kèm item **tự bật** toggle context | User vừa chủ động yêu cầu dùng context → không bắt họ phải tìm nút toggle; vẫn tắt được bằng tay |
| `chatStore.reset()` giữ nguyên `attachedItems` + `contextEnabled` | "Xoá cuộc trò chuyện" không nên xoá nguồn context user đang dùng |
| T-M1-04 **hấp thụ** vào T-M1-23 | Chip + toggle là cùng một UI, tách làm trùng lặp |

### Việc đã xong gần nhất (T-M1-21 + T-M1-22 — Trích xuất PDF & transcript YouTube)

- **T-M1-21 (PDF)** — `apps/server/src/lib/pdfExtractor.ts` parse bằng `pdfjs-dist@^4.10.38` (build `legacy`) · `apps/server/src/lib/safeFetch.ts` chặn SSRF (loopback/private/link-local/CGNAT/IPv6 nội bộ/IPv4-mapped, redirect ≤ 3 hop, timeout 15s, size cap 20 MB) · `POST /api/extract/pdf`.
- **T-M1-22 (YouTube)** — `apps/server/src/lib/youtubeExtractor.ts`: watch page → `POST youtubei/v1/player` client `ANDROID` (`clientVersion 20.10.38`, `androidSdkVersion 34`, header `X-Youtube-Client-Name: 3`) → `captionTracks` → `timedtext` XML → `[mm:ss] text`. Ưu tiên `vi` → `en`; track thủ công trước `asr`.
- **Contract** — `packages/shared/src/pageKind.ts` (`detectPageKind` / `extractYouTubeVideoId` / `isPdfUrl`) + `schemas/extract.ts` + 4 error code `CONTEXT_*` + `pageContextSchema` có `sourceKind`/`contextError`.
- **Extension** — `captureTabContext()` phân nhánh theo loại trang; `ContextNotice.tsx` hiển thị lỗi trích xuất trên Composer (PDF scan / không có caption).
- **Nguyên tắc bất di bất dịch:** lỗi trích xuất **luôn trả HTTP 200** kèm `error` trong body → panel chỉ hiện thông báo, chat không bao giờ hỏng.
- +44 unit test + 2 E2E. Bằng chứng: `docs/IMPLEMENTATION_PLAN.md` §3.1b.

### Quyết định kỹ thuật mới (T-M1-21/22)

| Quyết định | Lý do |
|---|---|
| `pdfjs-dist@^4.10.38` (bản cuối Node ≥ 20) thay vì `unpdf` | `unpdf` yêu cầu Node ≥ 24, repo dùng Node 22 (`.nvmrc`) |
| `pdfjs-dist` chỉ nằm ở `apps/server` | Không kéo ~10 MB vào bundle extension → `dist/content.js` giữ nguyên ~4.8 kB |
| Client InnerTube `ANDROID` (không phải `WEB`) | Client `WEB` yêu cầu `signatureCipher`/`poToken` → `timedtext` trả về rỗng; client `ANDROID` trả `baseUrl` có `signature` hợp lệ |
| BFF tự theo redirect (tối đa 3 hop) thay vì `redirect: 'follow'` | Không kiểm soát được host của hop tiếp theo → mất lớp chống SSRF |
| Lỗi nghiệp vụ trả HTTP 200 + `error` trong body | Client (side panel) chỉ cần đọc body; tránh phân biệt status → đơn giản hoá UI, không làm hỏng chat |
| `detectPageKind()` đặt ở `packages/shared` (không trong extension) | Cả extension lẫn server đều cần → 1 nguồn sự thật; nhưng **không** export qua subpath `./constants` để content script không kéo theo `zod` |
| `pageContextSchema` mở rộng `sourceKind` + `contextError` ngay | Tránh sửa contract lần 2 ở T-M1-23 (ngân sách context) |

### Audit docs FR ↔ Task (2026-11-04)

Rà soát toàn bộ `docs/` đối chiếu `REQUIREMENTS.md` ↔ `IMPLEMENTATION_PLAN.md`. Kết quả:

- **Phát hiện:** **31 FR + 27 NFR (58 yêu cầu)** chưa được map tới task nào trong cột FR của plan. Đáng chú ý nhất: `FR-CONTEXT-05` (PDF) và `FR-CONTEXT-06` (YouTube) — không có task card nào dù `REQUIREMENTS.md` §4.2 đã liệt kê (PDF còn bị ghi nhầm vào T-M1-06); `FR-CONTEXT-07` (ngân sách context, **Must**); `FR-VISION-01` (upload ảnh, **Must**); `FR-UX-02` (onboarding, **Must**). Ngoài ra 2 nhãn FR sai: T-M1-04 (`FR-CONTEXT-09`) và T-M1-06 (`FR-CONTEXT-05`).
- **Đã sửa:** thêm 11 task card mới (T-M1-21..25, T-M2-19..22, T-M3-10..11) · sửa 2 nhãn FR sai · bổ sung FR/NFR vào 12 task card cũ · thêm bảng traceability đầy đủ (83 FR + 29 NFR) ở `REQUIREMENTS.md` §11.1 và bản rút gọn ở `IMPLEMENTATION_PLAN.md` §3.2.
- **Quyết định:** nâng `FR-CONTEXT-05` / `FR-CONTEXT-06` từ **Should → Must** (Edge A20 + Gemini B10 đều ở mức Must) → M1 tăng 20 → 25 task.
- **Trạng thái:** chỉ sửa **docs**, chưa viết code. Task implement lần lượt: T-M1-21 → T-M1-22 → T-M1-23 → T-M1-24 → T-M1-25.

> **Cập nhật 2026-11-04 (sau khi implement):** T-M1-21 + T-M1-22 + **T-M1-23** **đã xong**. M1 hiện **5/25 task** (T-M1-01 · T-M1-21 · T-M1-22 · T-M1-23 + T-M1-04 hấp thụ). Thứ tự tiếp theo: **T-M1-05** (`@` multi-tab — nguồn item tier `attachment`) → **T-M1-02** (selection — tier cao nhất) → **T-M1-24** (upload file — tier `attachment`) → **T-M1-25** (onboarding) → rồi quay lại **T-M1-06** (truyền context — contract `context.items[]` đã sẵn sàng) → T-M1-07 (markdown/code).
>
> **Cảnh báo khi làm T-M1-05 / T-M1-02 / T-M1-24:** các task này giờ chỉ cần **tạo ra `ContextItem`** (đúng `kind` + `tier`) rồi gọi `attachItem()` — logic cắt bớt, meter, toggle, prompt rendering đã xong ở T-M1-23. Không cần sửa lại logic budget.
>
> **Lưu ý khi sửa E2E cũ:** context không còn tự capture mỗi lượt → test nào dựa vào việc gửi prompt là thấy `ContextNotice` đều phải bấm "Thêm trang này" trước (xem `e2e/extract.spec.ts` đã cập nhật).

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
| PDF + YouTube transcript **nâng lên Must** (2026-11-04) | Edge Copilot (A20) và Chrome Gemini (B10) đều có ở mức Must → cần để đạt gate parity M1 (≥90% dòng Must). Đánh đổi: M1 20 → 25 task |
| PDF/YouTube extract **ở BFF chứ không ở content script** | PDF viewer là plugin native của Chrome (content script không inject được); transcript YouTube nằm ở `captionTracks` chứ không phải DOM text. Cả 2 nhánh chuẩn hoá về cùng shape `context.text` → `buildContextPrompt()` không phân biệt nguồn (`docs/SYSTEM_DESIGN.md` §7.3.1) |
| Bảng FR ↔ Task đặt ở `REQUIREMENTS.md` §11.1 (không phải trong plan) | FR là nguồn chân lý; plan chỉ giữ bản rút gọn theo nhóm ở §3.2 → tránh trùng lặp 2 nơi dễ lệch |
| `FR-WORKFLOW-04` (trigger theo sự kiện) defer sang M5 | `chrome.tabs.onUpdated` không đáng tin trong MV3 (SW bị kill ~30s) → phải dùng `chrome.alarms` ≥ 30s hoặc polling; rủi ro cao, không trên đường găng |
| **Context chỉ gửi khi user chủ động đính kèm** (2026-11-04, T-M1-23) | Đã chốt với user: cần đường "chat như LLM thuần" (FR-CONTEXT-13) + biểu diễn nhiều nguồn theo thứ tự ưu tiên. Edge/Gemini mặc định share tab → khác biệt được ghi trung thực trong `COMPARISON_MATRIX.md` §D/§E + `EVAL_PLAN.md` FC-12 |
| **Toggle context mặc định TẮT, nhưng đính kèm item thì tự bật** (T-M1-23) | User vừa chủ động yêu cầu dùng context → không bắt họ tìm nút toggle; vẫn tắt được bằng tay |
| Logic ngân sách context đặt ở `packages/shared` dùng chung client + server | Meter "đã dùng X/Y" không được lệch với cái thực sự gửi đi; server cắt lại là nguồn chân lý |
| `context` = bundle `{ items: ContextItem[] }` có `tier`, nhận cả shape cũ qua `z.preprocess` | Nhiều nguồn + thứ tự ưu tiên; backward compatible để eval harness / client cũ không vỡ |

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
