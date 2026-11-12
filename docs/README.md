# Documentation Index — Sidekick AI (Chrome Extension Chat Sidebar)

**Dự án:** Extension chat-bot sidebar cho trình duyệt, cạnh tranh với Edge Copilot Sidebar và Chrome Gemini Sidebar.
**Giai đoạn hiện tại:** **M0 (Foundation) ✅** (tag `v0.1`) · **M1 (Parity) ✅ ĐÓNG** (tag `v0.2`) — **23/25 task** (T-M1-13 export ✅ 2026-11-09) · **M2 đang làm — 14/24 task ✅** (T-M2-02 · T-M2-03 · T-M2-03b · T-M2-04 · T-M2-05 · T-M2-06 · T-M2-21 · T-M2-07 · T-M2-09 · T-M2-08 · **T-M2-12 · T-M2-13 · T-M2-14 · T-M2-23**) · **3 task ⏸** (T-M2-01 đẩy · **T-M2-10 + T-M2-11 RAG hoãn 2026-11-11**) · **7 task ⬜** — **2049 unit test + 108 E2E** · kiểm chứng live trên Chrome thật **15/15** mục (`pnpm manual:checklist`) · **tiếp theo: T-M2-15 → 17 (eval — cần người thật)** → `docs/EVAL_REPORT.md` (deliverable bắt buộc).
**Entry point cho agent:** [`../AGENTS.md`](../AGENTS.md) · [`HANDOFF.md`](HANDOFF.md)

---

## Cấu trúc tài liệu

| Tài liệu | Vai trò | Nội dung | Đọc khi nào |
|---|---|---|---|
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | **Nguồn sự thật cho sản phẩm** | Mục tiêu, parity summary, 14 user stories, 83 FR, 29 NFR, kiến trúc, data model, rủi ro, roadmap M0–M4, **bảng FR ↔ Task (§11.1)** | Khi cần biết "cần làm gì" và "vì sao" |
| [`COMPARISON_MATRIX.md`](COMPARISON_MATRIX.md) | **Đối chiếu & gap** | 28 tính năng Edge (A1–A28), 28 tính năng Chrome Gemini (B1–B28), 15 tính năng độc quyền (C1–C15), nguồn trích dẫn, checklist parity M1 & M4 | Nghiên cứu thêm feature, hoặc nghiên cứu thêm feature để bổ sung |
| [`EVAL_PLAN.md`](EVAL_PLAN.md) | **Chứng minh chất lượng** | Dataset 48 task (5+1 nhóm), rubric 8 tiêu chí, judge prompt, metrics, quy trình thu thập transcript Edge/Gemini, 11 fairness controls, timeline | **Yêu cầu bắt buộc của giảng viên** — đọc kỹ |
| [`DESIGN_SYSTEM_BRIEF.md`](DESIGN_SYSTEM_BRIEF.md) | **Ràng buộc UI** | 7 design principles, design tokens, component inventory, state chuẩn hoá, checklist WCAG 2.2 AA, traceability ↔ FR | Khi làm UI hoặc thêm component mới |
| [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) | **Cách code** | Kiến trúc tổng thể, 12 ADR, cấu trúc thư mục, hợp đồng API (31 endpoint), giao thức SSE (9 event), data model Drizzle, bảo mật, chiến lược test, rủi ro kỹ thuật | Khi viết API, schema, hoặc backend |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | **Kế hoạch thực thi** | 82 task có mã `T-Mx-xx` theo M0–M4, DoD, timeline 13 tuần, phân công 3 thành viên, kịch bản thiếu thời gian, **bảng FR → Task rút gọn (§3.2)** | Khi bắt đầu task, cập nhật trạng thái task |
| [`HANDOFF.md`](HANDOFF.md) | **Chuyển phiên chat** | Checklist bắt đầu chat mới (≤ 5 phút), trạng thái hiện tại, quyết định đã chốt, mẹo tiết kiệm token | **Đọc đầu tiên khi mở chat mới** |
| [`CHANGELOG.md`](CHANGELOG.md) | **Lịch sử thay đổi** | Mọi thay đổi docs + code, mới → cũ | Xem gần đây đã làm gì |
| [`MANUAL_TEST_GUIDE.md`](MANUAL_TEST_GUIDE.md) | **Hướng dẫn cài đặt & test tay** | Cài extension + chạy hạ tầng local · checklist test tay **từng tính năng** M1 · xử lý sự cố | **Khi bạn muốn tự dùng thử sản phẩm** |
| [`CONTEXT_HANDOFF_2026-11-09.md`](CONTEXT_HANDOFF_2026-11-09.md) | **Bàn giao context** (snapshot 1 lần) | Tóm tắt context để chuyển sang chat mới mà không đọc lại toàn bộ `docs/` | Khi cần nhanh 1 trang tóm tắt · ⚠️ **đã refresh 2026-11-10** (M2 2/22 task) |

---

## Thứ tự đọc đề xuất

```mermaid
flowchart LR
    H["HANDOFF.md<br/>Bắt đầu chat mới"] --> A["REQUIREMENTS.md<br/>Mục tiêu & yêu cầu"]
    A --> B["COMPARISON_MATRIX.md<br/>Đối chiếu & gap"]
    A --> S["SYSTEM_DESIGN.md<br/>Cách code"]
    A --> D["DESIGN_SYSTEM_BRIEF.md<br/>Chuẩn bị UI"]
    A --> P["IMPLEMENTATION_PLAN.md<br/>Task M0 → M4"]
    A --> C["EVAL_PLAN.md<br/>Cách chứng minh"]
    B --> P
    S --> P
    D --> P
    C --> P
    P --> I["Implementation<br/>(M0 → M1 → M2 → M3 → M4?)"]
```

**Cách nhanh nhất (khi bắt đầu chat mới):**
`HANDOFF.md` → `AGENTS.md` → task trong `IMPLEMENTATION_PLAN.md` → mở `SYSTEM_DESIGN.md` § liên quan.

---

## Quyết định kiến trúc đã chốt

| Hạng mục | Quyết định |
|---|---|
| Nền tảng | Chrome Extension Manifest V3 (Side Panel API, Chrome ≥ 114) |
| Frontend | React 18 + TypeScript + Vite + **Tailwind CSS + shadcn/ui** (Radix, copy code vào repo) |
| Client state | Zustand |
| Backend | BFF proxy chạy local qua **Docker Compose** (Node 20 + Express + TS) |
| Database | **PostgreSQL 16 + Drizzle ORM + pgvector** |
| Repo | **Monorepo pnpm workspace**: `apps/extension` · `apps/server` · `apps/eval` · `packages/shared` |
| LLM | Multi-provider adapter (Gemini, OpenAI, Anthropic, OpenRouter, Groq, Ollama); free tier trước |
| Chế độ dự phòng | 3 nguồn key: **K1** team key (`.env`) · **K2** BYOK qua BFF (mã hoá trong Postgres) · **K3** BYOK direct (`chrome.storage.local`, khi BFF tắt) — xem `REQUIREMENTS.md` §4.6.1 — **⏸ K2/K3 tạm dừng 2026-11-08**, M1 chỉ dùng **K1** + Ollama local |
| Phạm vi | Full parity 2 hệ thống + tính năng nâng cao (MCP, Skills, multi-provider, log/cost). **RAG local = ⏸ hoãn 2026-11-11** (xem `REQUIREMENTS.md` §9.3). **Workflow automation = M4, implement cuối cùng** |
| Đánh giá | Offline benchmark (LLM-as-judge) **+** live manual test (rubric con người) |
| Streaming | Trực tiếp Side Panel → BFF (không qua service worker — MV3 SW bị kill ~30s) |

Chi tiết lý do & hệ quả: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §2 (12 ADR).

---

## Tóm tắt các điểm khác biệt so với 2 hệ thống có sẵn

1. **Multi-provider + BYOK** — không phụ thuộc model của hãng. *(BYOK ⏸ tạm dừng 2026-11-08 — hiện chỉ còn K1 team key + Ollama local)*
2. **Self-hostable** — toàn bộ server chạy local, dữ liệu không rời máy.
3. **MCP-native** — mở rộng tool bất kỳ qua Model Context Protocol.
4. **Traceable** — log request đầy đủ, phục vụ audit và eval.
5. **Cost visibility** — token & chi phí theo từng lượt.
6. **Privacy theo domain** — không chỉ bật/tắt toàn cục.
7. **Công cụ eval tích hợp** — đo được, so sánh được, tái lập được.
8. **Workflow automation** — scheduler chạy nền trong sidebar, self-hosted, không cần license (M4, ngoài đường găng). Ở Edge/Gemini, tính năng này bị đẩy ra khỏi sidebar sang M365 Copilot Tasks / Gemini Apps.

---

## Ưu tiên triển khai

> **Workflow (M4) là tính năng implement cuối cùng**, chỉ bắt đầu khi M0–M3 đã ổn định và đã có báo cáo eval. Nếu thiếu thời gian, bỏ hẳn M4 mà **không** mất điểm ở các tiêu chí đã đạt. Chi tiết: [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.3 (thứ tự cắt) và §9.4 (điều kiện bắt đầu).

---

## Quy trình bắt buộc: cập nhật docs sau mỗi thay đổi

> Nguồn chính: [`../AGENTS.md`](../AGENTS.md) §5 và `.cursor/rules/docs-sync.mdc`.

1. Code xong → cập nhật `docs/` tương ứng (bảng ánh xạ trong `docs-sync.mdc` §1).
2. Thêm 1 entry vào [`CHANGELOG.md`](CHANGELOG.md).
3. Task dang dở → cập nhật [`HANDOFF.md`](HANDOFF.md) §2.
4. Commit.

**Task chưa cập nhật docs = chưa Done.**

---

## Trạng thái tài liệu

| Tài liệu | Phiên bản | Ngày | Trạng thái |
|---|---|---|---|
| REQUIREMENTS.md | v2.8 | 2026-11-12 | ✅ Đã cập nhật — thêm **FR-CONTEXT-14** (M) "Upload tài liệu đính kèm (PDF/DOCX/TXT/MD/CSV)" + bảng mapping FR → task (T-M2-23) |
| COMPARISON_MATRIX.md | v2.8 | 2026-11-12 | ✅ Đã cập nhật — **§C17** upload tài liệu cục bộ (**độc quyền** — Edge/Gemini không có) + dòng §D · **gate §E giữ nguyên 34/35 = 97.1%** |
| EVAL_PLAN.md | v1.6 | 2026-11-12 | ✅ Đã cập nhật — §3.1 bảng field bắt buộc + ghi chú contract `evalTaskSchema` · **§7 cây thư mục khớp code thật** (tách `src/commands/*` + `src/results/judgeStore.ts`) + **§7.1 lệnh vận hành** (`eval:collect` · `eval:run -- run` · `eval:judge` · `eval:report`) + **§7.2 blind mapping deterministic** |
| DESIGN_SYSTEM_BRIEF.md | v2.4 | 2026-11-12 | ✅ Đã cập nhật — §3.4 `Composer` nút `Paperclip` (1 picker cho ảnh **+** tài liệu) + `AttachmentTray` danh sách tài liệu (T-M2-23) |
| SYSTEM_DESIGN.md | v3.1 | 2026-11-12 | ✅ Đã cập nhật — **§7.29** upload tài liệu PDF/DOCX/TXT/MD/CSV (endpoint `POST /api/extract/document` · contract · `documentExtractor` sniff magic byte · extension · quyết định no-persist · giới hạn) (T-M2-23) + **§4.1** bảng endpoint · **§7.22** model picker + fallback chain + **§7.23** token & chi phí + **§7.24** budget cap + **§7.25** Skills + **§7.26** tool registry + **§7.27** MCP client · **§4.5** contract eval mở rộng (`pages?` · `assets?` · `context_mode?` · `evalJudgeResultSchema`) + **§7.28** eval harness + metrics + LLM-as-judge (T-M2-12/13/14) + **§7.28.9** bug phát hiện khi chạy eval thật · **ADR-10** ghi trạng thái RAG ⏸ hoãn |
| IMPLEMENTATION_PLAN.md | v3.1 | 2026-11-12 | ✅ Đã cập nhật — bảng task M2 có **cột `Status`** (**14 ✅ / 3 ⏸ / 7 ⬜**) · **T-M2-23 ✅** (upload tài liệu FR-CONTEXT-14) · **T-M2-12/13/14 ✅** (dataset 52 task · harness + metrics · judge + blind) · **T-M2-10 + T-M2-11 (RAG) → ⏸ hoãn** · **§4.1** header đồng bộ + **bảng metric thật theo nhóm** + bảng bug phát hiện khi chạy eval thật · **§4.1.4** dòng RAG → nhóm ⏸ + dòng Eval tự động ✅ · **§4.1.5** ưu tiên 1 = **T-M2-15 → 17 (cần người thật)** · §8 timeline · §10 dòng 3 → đã chốt cắt |
| HANDOFF.md | v3.2 | 2026-11-12 | ✅ Đã cập nhật — tiến độ M2 gom theo nhóm (**14/24 ✅**) + **mục "Quyết định mới (2026-11-12) — upload tài liệu (FR-CONTEXT-14)"** (core + no-persist + lý do + giới hạn) · ghi rõ **nền có sẵn / còn thiếu** cho Tools/MCP/RAG · Eval · Could · **mục "Quyết định mới (2026-11-11) — hoãn RAG"** · **mục "Chuẩn bị cho Eval (T-M2-15 → 17)"** (kèm **kết quả eval thật đầu tiên** + lệnh chạy lại + rủi ro RPM provider) |
| CHANGELOG.md | v2.9 | 2026-11-12 | ✅ Đang theo dõi — entry "Added": **T-M2-23 upload tài liệu PDF/DOCX/TXT/MD/CSV** + kết quả eval thật (Overall 85.1/100) · "Changed": `POST /api/extract/document` 413 + prop `onFilesSelected` · "Fixed": 4 bug phát hiện khi chạy eval thật |
| MANUAL_TEST_GUIDE.md | v1.1 | 2026-11-10 | ✅ Đã cập nhật — **§11b** test model picker + fallback + chi phí (mới) |

## Trạng thái milestone

| Milestone | Nội dung | Trạng thái |
|---|---|---|
| **M0 — Foundation** (2 tuần) | Monorepo, shared types, Docker/Postgres, Drizzle, BFF skeleton, provider Gemini, SSE, side panel shell | ✅ Xong (tag `v0.1`) |
| **M1 — Parity** (3 tuần) | Content extraction (HTML + PDF + YouTube transcript), context đính kèm chủ động + ngân sách token, `@` multi-tab, selection, citations, markdown/code, conversation CRUD, chat actions (regenerate/edit-resend/stop/continue), gợi ý theo trang + tóm tắt 1-click, toggle panel + context menu + phím tắt, settings, upload ảnh, onboarding, **error/loading/empty states + retry + connection status**, **request logging đầy đủ vào `request_logs`** (request-id xuyên suốt · cost thật · retention 90 ngày · API đọc metadata cho eval), **i18n VI/EN** (dictionary có kiểu · đổi ngôn ngữ áp dụng ngay), **phím tắt cấu hình được** (2 lớp: native Chrome + nhanh Sidekick), **responsive 320–640px + a11y pass cơ bản** (focus ring chuẩn hoá · live region streaming · skip-link · tap target 24px), **export conversation Markdown/JSON**, K2/K3 | ✅ **Xong (tag `v0.2`)** — 23/25 task (T-M1-15 + T-M1-16 ⏸ tạm dừng) · gate đạt: checklist §E **32/35 = 91.4%** · dòng "Must" §A/§B **21/23 = 91.3%** |
| **M2 — Advanced & Eval** (3 tuần) | Multi-provider, skills, tool registry + MCP, token/cost UI, **upload tài liệu**, **EVAL_REPORT** | 🟡 **Đang làm — 14/24 task ✅** · T-M2-02 ✅ (model picker động + fallback chain runtime + event `provider_switch` + log `fallback_from`) · T-M2-03 ✅ (badge token/chi phí + section "Chi phí & sử dụng" theo ngày) · **T-M2-03b ✅** (budget cap enforce **phía server** — bảng `budget_settings`) · **T-M2-04 ✅** (Skills: menu `/` + CRUD + seed built-in + server resolve) · T-M2-05 ✅ (import/export JSON) · T-M2-06 ✅ (library browser lọc theo tag) · T-M2-21 ✅ (9 skill built-in + điều kiện tab) · T-M2-07 ✅ (tool registry + builtin calculator + agent loop) · T-M2-09 ✅ (tool call UI + approval gate) · T-M2-08 ✅ (MCP client stdio + server manager + UI Settings) · **T-M2-23 ✅** (upload tài liệu PDF/DOCX/TXT/MD/CSV — `POST /api/extract/document` · **no-persist**) · **T-M2-12 ✅** (dataset eval **52 task / 8 nhóm** + **47 snapshot** trang thật + `dataset_meta.json`) · **T-M2-13 ✅** (harness: SSE client + runner + metrics aggregator) · **T-M2-14 ✅** (LLM-as-judge `temperature: 0` + blind mapping deterministic) · T-M2-01 ⏸ đẩy (không thêm provider mới) · **T-M2-10 + T-M2-11 (RAG) ⏸ hoãn 2026-11-11** · **tiếp theo: T-M2-15 → 17 (eval — cần người thật)** |
| **M3 — Polish & Deliverable** (1 tuần) | Design system, states, a11y audit, i18n, demo video, slide, README, backup DB, ADR | ⬜ Chưa bắt đầu |
| **M4 — Workflow** (tuỳ chọn, 2 tuần) | Scheduler, workflow CRUD, run log, import/export, notification | ⬜ Ngoài đường găng |

Chi tiết task: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

---

## Điều kiện cần để bắt đầu implement M1

- [x] Giảng viên duyệt hướng tiếp cận (requirements + eval plan)
- [x] Chốt stack UI (Tailwind + shadcn/ui) và data layer (Drizzle + Postgres)
- [x] Chốt cấu trúc repo (monorepo pnpm) và versioning (git local)
- [ ] Chốt provider dùng để đối chiếu công bằng với Chrome Gemini (`REQUIREMENTS.md` §10, Q1)
- [ ] Chốt ngân sách API key cho eval (§10, Q3)
- [ ] Xác nhận có/không làm user study (§10, Q4)
