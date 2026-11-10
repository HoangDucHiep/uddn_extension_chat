# Feature Comparison Matrix — Edge Copilot vs Chrome Gemini vs Sidekick AI

**Version:** v2.5 · **Ngày:** 2026-11-10 · **Nguồn:** tài liệu chính thức Microsoft Support, Google Chrome Help, Chrome DevDocs (đã tổng hợp ở §0)

Ký hiệu: ✅ Có đầy đủ · ⚠️ Có nhưng có hạn chế / khác biệt · ➖ Không có · 🟢 Điểm mạnh độc quyền của Sidekick AI

Cột ưu tiên: **M** = Must (M1) · **S** = Should (M2) · **C** = Could (M2/M3) · **—** = Không triển khai

---

## 0. Ghi chú nguồn

| Hệ thống | Nguồn chính |
|---|---|
| Microsoft Copilot in Edge | [Getting started with Copilot in Microsoft Edge](https://support.microsoft.com/en-US/microsoft-copilot/getting-started-with-copilot-in-microsoft-edge) · [How context clues work](https://support.microsoft.com/en-US/microsoft-copilot/how-context-clues-work-copilot-edge) · [Your AI browser](https://www.microsoft.com/en-us/edge/copilot/ai-powered) · [Meet Copilot Mode in Edge](https://blogs.windows.com/msedgedev/2025/10/23/meet-copilot-mode-in-edge-your-ai-browser/) |
| Gemini in Chrome | [Use Gemini in Chrome](https://support.google.com/chrome/answer/16283624) · [Customize your Gemini in Chrome](https://support.google.com/chrome/answer/16988996) · [Skills in Chrome](https://blog.google/products-and-platforms/products/chrome/skills-in-chrome/) · [Gemini 3 & Auto Browse](https://blog.google/products-and-platforms/products/chrome/gemini-3-auto-browse/) · [AI in Chrome](https://www.google.com/chrome/ai-innovations/) |
| Copilot Actions (Edge) | [Copilot Actions in Edge](https://support.microsoft.com/en-gb/topic/copilot-actions-in-edge-5ed5e17e-42df-40a3-984a-20420eba86e2) — nguồn cho **A27** |
| Gemini Tasks & Schedules | [Tasks in Gemini Apps](https://support.google.com/gemini/answer/17094507) · [Schedule recurring prompts](https://support.google.com/gemini/answer/17094710) — nguồn cho **B28** |
| Side Panel API | [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) · [Modern Web Guidance — side panel](https://github.com/googlechrome/modern-web-guidance/blob/main/skills/chrome-extensions/references/extensions/side-panel.md) |

**Lưu ý về tính công bằng:** Cả Edge Copilot và Chrome Gemini đều là tính năng **built-in**, không phải extension. Chúng không có API công khai, không cho xuất transcript, và phụ thuộc tài khoản Microsoft 365 / Google (một số tính năng bị gate theo gói thuê bao). Bảng này ghi nhận **tính năng có sẵn ở điều kiện consumer thông thường**; các tính năng gate theo gói cao cấp được đánh dấu.

---

## A. Microsoft Copilot Sidebar (Edge)

| # | Tính năng | Chi tiết / hạn chế | Ưu tiên ta |
|---|---|---|---|
| A1 | Side panel cố định cạnh tab | Mở bằng toolbar button, giữ nguyên khi đổi tab | M |
| A2 | Context Clues | Dùng URL, page title, page content/screenshots, browsing history. **Bật/tắt toàn cục** ở Settings › Copilot and AI | M |
| A3 | Chia sẻ dữ liệu duyệt web | **Không** lưu vào lịch sử chat — chỉ prompt + response được lưu | M (chọn lọc hơn) |
| A4 | Prompt gợi ý theo trang | Dựa trên title + URL của trang hiện tại | M |
| A5 | Page Summary 1-click | Nút "Create a Summary" | M |
| A6 | "Expand on this topic" | Mở rộng câu trả lời hiện tại | S |
| A7 | Multi-tab reasoning | So sánh recipe giữa nhiều tab, lên lịch bếp tối ưu | S |
| A8 | Hỏi theo vùng được bôi đen | Bấm icon Copilot trên content → chat mở với ngữ cảnh vùng chọn | M |
| A9 | Copilot Vision (screen share) | Cho Copilot xem màn hình. **Chỉ M365 subscriber** | C |
| A10 | Voice dictation | Microphone → speech-to-text. **Chỉ M365 subscriber** | C |
| A11 | Copilot Voice (voice chat) | Hội thoại nói. **Chỉ M365 subscriber** | C |
| A12 | Vision (phân tích ảnh) | Phân tích nội dung ảnh | S |
| A13 | Image Creator | Tạo ảnh | C |
| A14 | Copilot Actions | Thực hiện hành động thay bạn | C |
| A15 | @Copilot | Gắn @ vào ngữ cảnh | M |
| A16 | Copilot Mode | Reasoning xuyên nhiều tab, dynamic pane | C |
| A17 | Trợ lý "so sánh nhiều tab" | So sánh sản phẩm/recipe từ nhiều tab | S |
| A18 | Browsing history opt-in | Dùng lịch sử duyệt để trả lời ("chiếc hoodie xanh tuần trước") | S |
| A19 | Tạo podcast / study guide / quiz từ trang | Sinh nội dung học tập | C |
| A20 | Tóm tắt video / PDF | Tóm tắt nội dung video và PDF | M |
| A21 | Copilot Daily | Nội dung/digest hằng ngày | C |
| A22 | Chọn model | Không cho chọn model (chỉ model của Copilot) | 🟢 FR-PROVIDER-03 |
| A23 | API / BYOK | Không có | 🟢 FR-PROVIDER-02 |
| A24 | Chọn vị trí panel (trái/phải) | Do người dùng đặt trong Chrome settings (dùng chung `getLayout()`) | M (tự cấu hình) |
| A25 | Keyboard shortcut mở Copilot | Không có shortcut mặc định (chỉ qua menu) | 🟢 FR-UX-01 — ✅ T-M1-03 (`Ctrl+Shift+K` toggle panel; đổi được → T-M1-18) |
| A26 | Yêu cầu đăng nhập | Bắt buộc đăng nhập tài khoản Microsoft; một số tính năng cần **M365 subscription** | 🟢 FR-PROVIDER-02 (không cần tài khoản hãng) |
| A27 | Copilot Actions (Edge) | Tác vụ web **một lần** có giám sát (đặt nhà hàng, sửa trang, huỷ newsletter). Có bước xác nhận cho hành động rủi ro (mua hàng, gửi email). **Preview, trong Copilot Mode** | C |
| A28 | Lịch chạy tự động | **Không có trong Edge.** Chỉ ở **M365 Copilot Tasks** (chạy ngay hoặc theo lịch, giới hạn 10 scheduled prompts) — cần **Copilot license**, sản phẩm khác, không nằm trong sidebar | 🟢 FR-WORKFLOW-03 (M4) |
| A29 | Trích dẫn nguồn (citations) | Câu trả lời dựa trên nội dung trang hiện tại hiện **số nguồn** kèm trích dẫn → bấm vào xem đoạn nguồn | M (chi tiết hơn: chip + popover đoạn nguồn) |
| A30 | Quản lý nhiều cuộc trò chuyện | Lịch sử chat trong Copilot sidebar: mở lại chat cũ, đổi tên, xoá | 🟢 FR-CHAT-08/09/11 (T-M1-09 — drawer quản lý chat + search + ghim + lưu trữ) |

---

## B. Gemini in Chrome (Sidebar)

| # | Tính năng | Chi tiết / hạn chế | Ưu tiên ta |
|---|---|---|---|
| B1 | Side panel cố định cạnh tab | Mở bằng nút "Ask Gemini" hoặc shortcut | M |
| B2 | Share tab hiện tại | **Mặc định share** nội dung tab hiện tại khi bắt đầu chat mới | M |
| B3 | Tắt share tab hiện tại | Người dùng chủ động tắt được | M |
| B4 | Multi-tab share | Tối đa **10 tab** gần đây qua `@` hoặc nút "Add tabs"; tab đã share có dấu check, tab đang dùng có gạch chân phát sáng | M (không giới hạn) |
| B5 | Select content để hỏi | Bôi đen text / chọn ảnh / chọn sản phẩm → hỏi về đúng nội dung đó | M |
| B6 | Skills (`/`) | Lưu prompt tái sử dụng, gọi bằng `/`; có thể remix từ library có sẵn; chạy trên tab hiện tại + tab được chọn | M — ✅ T-M2-04 (menu `/` lọc prefix + Enter chọn + Tab autocomplete; server resolve `prompt_template` + `model` override) · chạy trên tab điều kiện → T-M2-21 |
| B7 | Tạo Skill mới | Từ 1 prompt trong chat history | M — ✅ T-M2-04 (action "Lưu thành kỹ năng" trên user message → prefill form) |
| B8 | Library Skill có sẵn | Sẵn nhiều skill mẫu (protein max, check job fit, explain simply…) | S — 🟡 T-M2-04 seed **tối thiểu 3** (`tom-tat` · `giai-thich-don-gian` · `dich`) · thư viện ≥ 8 → T-M2-21 |
| B9 | Summarize | Tóm tắt trang, bài viết, thread | M |
| B10 | Tóm tắt video YouTube | Dùng transcript video | M |
| B11 | Nano Banana | Tạo/sửa ảnh ngay trong tab | C |
| B12 | Auto Browse | Agentic: tự duyệt web, làm việc hộ. **Preview, chỉ AI Pro/Ultra** | C |
| B13 | Connected apps | Tích hợp Gmail, YouTube, Flights, Google apps | C (qua MCP) |
| B14 | Gemini Live (voice) | Voice chat, share tab trong Live | C |
| B15 | Personal Intelligence | Hiểu lịch sử Gemini app để cá nhân hoá. **Chỉ một số vùng** | S (RAG local) |
| B16 | History recall | Nhớ tab đã mở tuần trước | S |
| B17 | Upload ảnh | Gửi ảnh kèm câu hỏi | M |
| B18 | Multi-conversation | Nhiều cuộc trò chuyện cùng lúc | M |
| B19 | Keyboard shortcuts | Windows: `Alt+G` mở/toggle, `Alt+Shift+G` switch, `Ctrl+Alt+G` selection mode; macOS `Ctrl+G`/`Ctrl+⌘+G`/`Ctrl+Shift+G`; ChromeOS `Search+G` | M (tự cấu hình) — ✅ T-M1-03 (`Ctrl+Shift+K` toggle panel; đổi được → T-M1-18) |
| B20 | Connected apps / Skills cần sign-in Google | Ràng buộc vào hệ sinh thái Google | 🟢 FR-PROVIDER-02 |
| B21 | Chọn model | Không cho chọn model (chỉ model của Gemini) | 🟢 FR-PROVIDER-03 |
| B22 | API / BYOK | Không có | 🟢 FR-PROVIDER-02 |
| B23 | Chạy ngoài Chrome | Không | 🟢 (thiết kế không cấm Firefox) |
| B24 | Log / export transcript | Không có API; người dùng phải copy tay | 🟢 FR-CHAT-10, NFR-MAINT-04 — ✅ T-M1-13 (export .md/.json + copy Markdown) |
| B25 | Self-host | Không | 🟢 FR-PROVIDER-07 |
| B26 | Skill library browser (`chrome://skills/browse`) | Trang xem sẵn skill mẫu, lọc theo loại/tên | S — ⬜ T-M2-06 (lọc theo tag/tên + click để chạy ngay) |
| B27 | Yêu cầu đăng nhập | Bắt buộc đăng nhập Google Account; Skills cần **Chrome ≥ 147**, ngôn ngữ **en-US**, ChromeOS/Mac/Windows; không dùng được trên managed/Enterprise account (trừ khi admin bật) | 🟢 Không cần tài khoản hãng; chạy offline được |
| B28 | Tasks / Schedules (chạy nền theo lịch) | **Không có trong sidebar.** Nằm ở **Gemini Apps** (`gemini.google.com`) — không phải Gemini in Chrome. Hỗ trợ time-based (once/hourly/daily/weekly/monthly/yearly), Gmail monitor, topic monitor. Skill = cách làm, Schedule = khi nào chạy | 🟢 FR-WORKFLOW-03/04 (M4) |
| B29 | Trích dẫn nguồn (citations) | Câu trả lời từ nội dung tab được share hiện **số tham chiếu** → bấm xem nguồn | M (chi tiết hơn: chip + popover đoạn nguồn) |
| B30 | Multi-conversation | Nhiều cuộc trò chuyện cùng lúc (B18) — mở lại, đổi tên, xoá chat cũ | 🟢 FR-CHAT-08/09/11 (T-M1-09 — drawer quản lý chat + search + ghim + lưu trữ) |

---

## C. Tính năng độc quyền của Sidekick AI (không hệ thống nào có)

| # | Tính năng | Requirement | Giá trị đối chiếu |
|---|---|---|---|
| C1 | **Multi-provider + model picker** (OpenAI, Gemini, Anthropic, OpenRouter, Groq, Ollama) | FR-PROVIDER-01/03 | Đánh trực tiếp A22, B21 |
| C2 | **BYOK** — tự mang API key, key mã hoá phía server | FR-PROVIDER-02 ⏸ | Đánh trực tiếp A23, B22 — **⏸ tạm dừng 2026-11-08** (BYOK bị gỡ khỏi sản phẩm; server giữ nguyên `provider_keys` để mở lại sau) |
| C3 | **Self-host BFF** qua Docker Compose, chạy hoàn toàn local | §6, FR-PROVIDER-07 | Đánh trực tiếp B25 |
| C4 | **MCP-native tool integration** | FR-TOOLS-01/02 | Đánh trực tiếp B13 (thay thế bằng chuẩn mở) |
| C5 | **Log request đầy đủ có cấu trúc** (prompt, context hash, token, cost, latency, tool call) | NFR-MAINT-04, §7.2 | Đánh trực tiếp B24; **đây là nền tảng cho eval** — T-M1-06 đã sửa `context_hash` thành hash của **context thật đã gửi** (trước đó là hash toàn bộ prompt) + thêm `context_snapshot` theo setting |
| C6 | **Token & cost visibility** theo lượt + budget cap | FR-PROVIDER-05/06 | Không có ở A/B — **T-M2-03 (FR-PROVIDER-05)** ✅: badge token/cost theo lượt + section "Chi phí & sử dụng" (tổng + theo ngày). **T-M2-03b (FR-PROVIDER-06)** ✅: budget cap **enforce phía server** (hạn mức USD theo kỳ `daily`/`monthly`, cảnh báo ở ngưỡng, **tùy chọn chặn** lượt chat mới khi vượt hạn mức — server **không gọi provider** → chi phí = 0). Cấu hình lưu trong Postgres (bảng `budget_settings`) → server là nguồn chặn sự thật. Chi tiết: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.23 · §7.24 |
| C7 | **RAG local** trên lịch sử chat + tài liệu, có trích dẫn | FR-TOOLS-05 | Minh bạch hơn B15 (Personal Intelligence) |
| C8 | **Allowlist/denylist context theo domain** | FR-CONTEXT-08 | Mạnh hơn A2 (chỉ bật/tắt toàn cục) |
| C9 | **Công cụ eval tích hợp** (dataset, judge, dashboard) | `EVAL_PLAN.md` | Không có ở A/B |
| C10 | **Skill import/export JSON** | FR-SKILL-05 | Mở hơn B6 (phụ thuộc tài khoản Google) — ✅ **T-M2-05 (2026-11-10)** — nút "Xuất JSON" / "Nhập JSON" trong drawer Kỹ năng · file `version: 1` + `exportedAt` + `skills[]` · export chỉ scope `user` · import bỏ `id`/`scope`/timestamp (server tự sinh id mới) · trùng tên → bỏ qua |
| C11 | **Direct/BYOK fallback mode** khi BFF không chạy | NFR-REL-03, FR-PROVIDER-08/09 ⏸ | Resilience — không hệ thống nào cần — **⏸ tạm dừng 2026-11-08** |
| C11b | **3 nguồn key** (team key / BYOK qua BFF / BYOK direct) — linh hoạt cho demo lẫn production | FR-PROVIDER-08/09, §4.6.1 ⏸ | Quota tách theo người dùng, không bị lock-in — **⏸ tạm dừng 2026-11-08**; M1 chỉ dùng **K1** (team key trong `.env` BFF) |
| C12 | **Agentic action có bước xác nhận + diff** | FR-TOOLS-04 | An toàn hơn A14/B12 (chưa thấy yêu cầu xác nhận chi tiết) |
| C13 | **Không cần tài khoản hãng** (không Microsoft / không Google), chạy được trên managed/Enterprise browser | FR-PROVIDER-02, FR-PROVIDER-07 | Đánh trực tiếp A26, B27 |
| C14 | **Skill library browser nội bộ** (xem/lọc skill) | FR-SKILL-07 | Tương đương `chrome://skills/browse` nhưng không phụ thuộc Google — ✅ **T-M2-06 (2026-11-10)** — tab "Thư viện" trong drawer Kỹ năng · lọc server theo `?q=` (tên/mô tả) + `?tags=` (mode `any`) · chip tag · click card → chạy ngay |
| C15 | **Scheduler chạy nền trong sidebar, self-hosted, không cần license** | FR-WORKFLOW-03, §4.7 | Đánh trực tiếp A28, B28 — cả hai đều đẩy tính năng này ra khỏi sidebar sang sản phẩm khác (M365 Copilot Tasks / Gemini Apps) |

---

## D. Bảng tổng hợp theo nhóm tính năng

| Nhóm | Edge Copilot | Chrome Gemini | Sidekick AI | Gap còn lại sau M1 |
|---|---|---|---|---|
| Lõi chat (streaming, markdown, code) | ✅ | ✅ | ✅ | — |
| Context trang | ✅ | ✅ (mặc định bật) | ✅ (**đính kèm chủ động** — T-M1-23) | — |
| Context PDF / video (transcript) | ✅ (A20) | ✅ (B10) | ✅ (T-M1-21/22) | — |
| Multi-tab | ✅ không giới hạn | ✅ tối đa 10 | ✅ không giới hạn | — |
| Selection → hỏi | ✅ | ✅ | ✅ (T-M1-02) | — |
| Trích dẫn nguồn (chip + popover) | ✅ | ✅ | ✅ (T-M1-08 — chi tiết hơn: popover xem **đoạn nguồn**) | — |
| Summarize 1-click | ✅ | ✅ | ✅ | — |
| Prompt gợi ý theo trang | ✅ | ✅ | ✅ | — |
| Lịch sử / nhiều conversation | ✅ | ✅ | ✅ (T-M1-09 — drawer quản lý chat: tạo/đổi tên/xoá/ghim/lưu trữ/search) | — |
| Skills | ➖ | ✅ | ➖ | S (M2 — ✅ T-M2-04: `/` + CRUD · 🟡 T-M2-06 library browser · ⬜ T-M2-21 thư viện ≥ 8 skill) |
| Voice | ✅ (M365) | ✅ | ➖ | C |
| Vision / screen share | ✅ (M365) | ➖ | ⚠️ | C |
| Image gen | ✅ | ✅ | ➖ | C |
| Agentic browse | ✅ Actions | ✅ Auto Browse (Pro/Ultra) | ⚠️ | C |
| Connected apps | ✅ M365 | ✅ Google | ➖ (MCP) | C |
| Multi-model / BYOK | ➖ | ➖ | 🟢 | — |
| Self-host / offline | ➖ | ➖ | 🟢 | — |
| MCP | ➖ | ➖ | 🟢 | — |
| Log & eval | ➖ | ➖ | 🟢 | — |
| Cost visibility | ➖ | ➖ | 🟢 | — |
| Per-domain privacy | ⚠️ | ➖ | 🟢 | — |
| Scheduler chạy nền theo lịch | ❌ (chỉ ở M365 Tasks, cần license) | ❌ (chỉ ở Gemini Apps, ngoài sidebar) | 🟢 (M4 — ưu tiên thấp nhất) | — |

> **Ưu tiên cột "Ưu tiên ta":** `M` = Must (M1) · `S` = Should (M2) · `C` = Could (M2/M3) · `—` = không triển khai.
> Workflow/scheduler (A28, B28, C15) được đánh dấu **M4 — implement sau cùng**, vì không nằm trong yêu cầu bắt buộc của giảng viên và là phần đầu tiên bị cắt nếu thiếu thời gian (xem [`REQUIREMENTS.md`](REQUIREMENTS.md) §9.3).

> **Khác biệt cơ chế context (T-M1-23) — cần nói rõ khi trình bày:**
> Edge Copilot và Chrome Gemini **mặc định share tab** (bấm vào icon là dùng ngay). Sidekick AI chọn mô hình **đính kèm chủ động**: tab hiện tại **không** tự vào context; user phải bấm "Thêm trang này" (hoặc `@` / bôi đen / upload file) thì nguồn đó mới được gửi lên. Toggle bật/tắt context **mặc định TẮT** và được lưu lại.
> - **Đánh đổi:** mất 1 điểm "tiện — không cần thao tác" so với Edge/Gemini; đổi lại có 1 điểm "minh bạch + riêng tư" mà Edge/Gemini **không** có (chip luôn hiện đang chia sẻ gì · không gửi gì khi không chủ động yêu cầu · có meter "đã dùng X/Y token").
> - **Ảnh hưởng eval:** nhóm task `general_qa` (chat không cần trang) đo đúng đường này — xem [`EVAL_PLAN.md`](EVAL_PLAN.md) §7 (FC-9). Không so sánh "share tab mặc định" của Edge/Gemini với "đính kèm chủ động" của Sidekick như cùng một hành vi.

---

## E. Khoảng trống cần đóng (checklist parity)

Dùng làm acceptance checklist cho M1.

- [x] Side panel mở được từ toolbar icon (không `default_popup`) — ✅ M0 · **✅ T-M1-03** (native toggle `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` — Chrome 114+ → click icon **mở/đóng**; `action.onClicked` chỉ là fallback cho Chrome cũ)
- [x] Context menu "Ask Sidekick" — ✅ T-M1-03 (2 mục: "Mở Sidekick AI" (`contexts: ['page']`) · "Hỏi Sidekick với đoạn đã chọn" (`contexts: ['selection']` → đoạn chọn vào context `tier: 'selection'`) · đăng ký lại an toàn qua `removeAll()` → `create()` → không lỗi duplicate id khi update extension)
- [x] Keyboard shortcut mở/toggle panel — ✅ T-M1-03 (`Ctrl+Shift+K` · macOS `Command+Shift+K` · custom command `sidekick-toggle-panel` tự xử lý toggle · trạng thái track bằng `chrome.storage.session` + `sidePanel.onOpened`/`onClosed`) — *đổi phím tắt cấu hình được → T-M1-18*
- [x] Panel giữ nguyên khi chuyển tab — ✅ **hành vi native của Chrome** (side panel thuộc **cửa sổ** → Chrome giữ panel mở khi đổi tab trong cùng cửa sổ; React state của panel sống suốt vì document không reload → thread · draft · context chips không mất) — **đã có E2E chứng minh**: `e2e/panelPersistence.spec.ts` (3 test) — (1) đổi tab → gallery đổi profile theo trang mới · (2) đổi tab **khi đã có thread** → thread giữ nguyên + panel vẫn đọc lại tab mới (đếm số lần `chrome.tabs.query`) · (3) đổi tab lần 2 → thread vẫn giữ
- [x] Stream token-by-token, hiện dần — ✅ M0
- [x] Markdown + bảng + code block + copy + syntax highlight — ✅ T-M1-07 (`react-markdown` + `remark-gfm` → bảng/strikethrough/task list · `rehype-highlight` (highlight.js đồng bộ, 37 ngôn ngữ) · code block có nhãn ngôn ngữ + nút 1-click copy → toast "Đã sao chép" · bảng rộng scroll ngang · `rehype-sanitize` allowlist thẩm chặn XSS · link `target="_blank" rel="noopener noreferrer"`)
- [x] Đọc nội dung trang hiện tại, bật/tắt được — đọc: ✅ T-M1-01 · bật/tắt: ✅ T-M1-04 (hấp thụ bởi T-M1-23)
- [x] Đọc nội dung file PDF (text-based) — ✅ T-M1-21
- [x] Lấy transcript video YouTube — ✅ T-M1-22
- [x] Ngân sách context + cắt bớt thông minh ("đã dùng X/Y token") — ✅ T-M1-23
- [x] Chat được mà không cần đính kèm trang/tài liệu nào (chat thuần LLM) — ✅ T-M1-23 (FR-CONTEXT-13) · *giới hạn: web search bật ở M2 — FR-TOOLS-03*
- [x] Upload ảnh kèm câu hỏi — ✅ T-M1-24 (paste · drag-drop · file picker · preview + xoá từng ảnh · giới hạn 5 MB/4 ảnh · lưu Postgres → multi-turn · Gemini `inline_data` + Groq/OpenRouter `image_url` · provider không hỗ trợ → tự fallback) — *đối chiếu B17*
- [x] `@` đính kèm tab (nhiều tab), hiện chip trạng thái — ✅ T-M1-05 (popover favicon + title + domain · dấu ✓ tab đã đính kèm · gạch tab đang active · lọc theo query)
- [x] Bôi đen → hỏi (selection context) — ✅ T-M1-02 (nút nổi "Hỏi Sidekick" cạnh vùng chọn + nút "Dính đoạn đã chọn" trong panel · tier `selection` cao nhất · panel đóng thì đoạn chờ lưu storage, mở sau tự nhận)
- [x] Trích dẫn nguồn: chip `[N]` trong câu trả lời → popover hiện **đoạn nguồn** + mở tab gốc — ✅ T-M1-08 (server đánh số nguồn theo tier `selection` > `attachment` > `currentTab` · LLM trả marker `[N]` → server parse, **loại số vượt phạm vi** · SSE `citation` trước `done` + lưu bảng `citations` · extension: remark plugin `citationPlugin` gắn `dataCitationIndex` → `CitationChip` + `CitationPopover` (Radix) + `CitationList` tóm tắt nguồn)
- [x] Context tái lập lượt chat (log `context_hash` khớp context đã gửi + snapshot theo setting) — ✅ T-M1-06 (hash deterministic của context **đã cắt ngân sách** · `context_snapshot` jsonb **mặc định TẮT** qua `LOG_CONTEXT_SNAPSHOT` · không gộp với cờ lưu prompt đầy đủ)
- [x] Không trích xuất lại trang đã đọc + fallback khi trang lỗi — ✅ T-M1-06 (cache theo URL+hash trong `chrome.storage.local` · TTL 30 phút · tối đa 20 entry · **không có UI mới**)
- [x] Nút tóm tắt 1-click — ✅ T-M1-11 (nút "Tóm tắt trang này" trong empty state · bấm 1 lần → tự đính kèm trang hiện tại rồi gửi `SUMMARY_PROMPT` · wording trùng dataset eval `summarize`)
- [x] Prompt gợi ý theo loại trang — ✅ T-M1-11 (bộ luật phân loại ở `packages/shared/src/pageProfile.ts`: docs / article / forum / video / pdf / shopping / general · mỗi profile **4** gợi ý có `{title}` · nút refresh xoay vòng deterministic trong cùng profile · đổi tab → đổi bộ gợi ý · không có tab đọc được → 4 gợi ý chung FR-UX-04)
- [x] Nhiều conversation: tạo / đổi tên / xoá / ghim — ✅ T-M1-09 (drawer `ConversationList` (Radix Dialog trượt từ trái) · tạo / đổi tên / xoá (có confirm dialog) / ghim / lưu trữ / search theo tên · **phạm vi: ghim ở cấp conversation**, ghim tin nhắn để task sau)
- [x] Stop / Regenerate / Edit-resend — ✅ T-M1-10 (regenerate tạo **biến thể** (switcher "1/2") lưu phía server `messages.meta` → không mất khi reload · edit-resend tạo **branch** (nhánh cũ giữ trong DB, hiển thị ở "Phiên bản cũ") · stop giữ nội dung dở + nút "Tiếp tục" (continue UPDATE message cũ) · Enter gửi / Shift+Enter xuống dòng / Esc dừng · tự lưu draft · auto-scroll chỉ khi ở đáy + nút "Cuộn xuống")
- [x] Export conversation (Markdown / JSON) — ✅ T-M1-13 (menu `ExportMenu` (Radix Popover) trong header panel · 3 hành động: **Sao chép Markdown** · **Xuất .md** · **Xuất .json** · `.md` có metadata đầu file + metadata từng lượt assistant (provider · model · token · request-id) + nguồn `[N]` · `.json` có `version`/`exportedAt`/`conversation`/`messages[]` · tên file `sidekick-<title>-<yyyyMMdd-HHmm>.<ext>` · chỉ xuất **đường đi active** · E2E `e2e/export.spec.ts` + unit `tests/export.test.ts`)
- [x] **Error / loading / empty states + retry + trạng thái kết nối** — ✅ **T-M1-19** (4 trạng thái có UI riêng trong `sidepanel/components/states/`: `LoadingState` skeleton · `EmptyState` (wrapper `PromptGallery`) · `ErrorState` card inline · `ConnectionBadge` + banner offline · **hành động khôi phục theo nhóm lỗi**: 401 → "Kiểm tra API key" (mở Settings) · 429 → đếm ngược rồi "Thử lại" · 5xx/network → "Thử lại" · retry tự động **1 lần** backoff 800 ms, **không** retry lỗi auth)
- [ ] Skills `/` + tạo/sửa/xoá skill + library có sẵn + trang duyệt skill library — 🟡 **T-M2-04 ✅ (2026-11-10)** · **T-M2-05 ✅** (import/export JSON) · **T-M2-06 ✅** (library browser lọc theo tag) · ⬜ T-M2-21 (thư viện ≥ 8 skill + skill gắn điều kiện) — *chi tiết ở §E.1.4*
- [x] Onboarding lần đầu 3 bước — ✅ T-M1-25 (bước 1 giải thích quyền · bước 2 chọn provider + nhập API key (BYOK K2) hoặc dùng Ollama không cần key · bước 3 thử câu hỏi bằng SSE thật · skippable ở mọi bước · mở lại được từ nút "Hướng dẫn" trong header) — *2026-11-08: ô nhập API key đã **gỡ** khỏi bước 2 (BYOK tạm dừng); provider cần key mà chưa có K1 hiện thông báo hướng dẫn*
- [x] Không bắt buộc đăng nhập tài khoản Microsoft/Google (BYOK hoặc local model) — ✅ T-M1-25 (BYOK K2 qua onboarding + Ollama local không cần key) — *2026-11-08: nhánh BYOK ⏸ tạm dừng; còn nhánh Ollama local không cần key (FR-PROVIDER-07)*
- [x] Settings: theme, cỡ chữ, chiều rộng, quản lý dữ liệu, i18n VI/EN — ✅ **T-M1-12** (drawer Settings trượt từ phải · theme light/dark/system theo `prefers-color-scheme` · cỡ chữ 4 mức + mật độ 3 mức + bề rộng 3 mức · quản lý dữ liệu: xoá lịch sử chat + xoá dữ liệu cục bộ (đều có confirm) + import/export JSON · endpoint BFF có validate qua `/api/health` · telemetry/history OFF mặc định · *provider/key → ⏸ T-M1-16*) · ✅ **T-M1-17** (i18n đầy đủ — dictionary có kiểu `vi.ts` là nguồn sự thật → thiếu key = lỗi `pnpm typecheck` · đổi ngôn ngữ áp dụng **ngay**, không reload · context menu extension + nút nổi content script cũng đổi theo)
- [x] Theme sáng/tối (đối chiếu Edge Copilot A24 · Chrome Gemini B12) — ✅ **T-M1-12** (class `.dark` + `data-theme` trên `<html>` → dùng token sẵn có, **không** hardcode màu · theme `system` nghe `prefers-color-scheme` → đổi nền OS là panel đổi ngay · áp dụng tức thì, không reload)
- [x] Chỉnh cỡ chữ / bề rộng panel — ✅ **T-M1-12** (`--font-scale` 0.9–1.2 · `--density-scale` 0.85–1.15 · `--panel-max-width` 400/640/960px · **không** sửa component nào, chỉ set biến CSS trên `<html>` · persist qua reload qua `chrome.storage.local` key `sidekick.settings`) — *giới hạn: bề rộng do user kéo trong Chrome → extension chỉ đặt thêm `max-width`*
- [x] Xoá dữ liệu / quyền riêng tư (NFR-SEC-07) — ✅ **T-M1-12** ("Xoá lịch sử chat" → `DELETE /api/conversations` · "Xoá dữ liệu cục bộ" → xoá khoa `sidekick.*` trong `chrome.storage.local`, **giữ** trạng thái onboarding · telemetry + history OFF mặc định)
- [x] Panel responsive 320–640px + a11y cơ bản (focus ring · aria-label · skip-link · screen reader streaming) — ✅ **T-M1-20** (panel không tràn ngang ở 320px — `#root` `min-width: min(var(--panel-min-width), 100%)` + drawer `max-w-full` · focus ring chuẩn hoá 1 token `--border-focus` · mọi icon-button ≥ 24px (WCAG 2.2 §2.5.8) + có `aria-label` · skip-link "Bỏ qua tới ô nhập" · live region chỉ trên phần đang stream · `role="tab"`/`tabpanel` cho tab nhóm conversation · E2E `e2e/responsive.spec.ts` + unit `tests/a11y.test.tsx`)
- [x] Token/cost hiển thị — ✅ **T-M2-03** (`UsageBadge` dưới bubble assistant: token vào/ra + `~ $0.0123` 4 chữ số thập phân, lấy `costUsd` từ SSE `usage` · provider local (mock/Ollama) → chỉ hiện token, không hiện `$0.0000` · section **"Chi phí & sử dụng"** trong Settings: tổng token + tổng chi phí + bảng phân rã **theo ngày** (`GET /api/usage`, khoảng `today/7d/30d/all`) · chi phí do **server** tính từ `PROVIDER_PRICING` → UI không lệch với giá thật)
- [x] Keyboard shortcuts cấu hình được — ✅ **T-M1-18** (Settings → "Phím tắt" · **2 lớp**: lớp native của Chrome (đọc `chrome.commands.getAll()` + nút mở `chrome://extensions/shortcuts`) + lớp nhanh của Sidekick (lưu `chrome.storage.local`, bấm để bắt phím) · **deny-list** 28 tổ hợp dành riêng của trình duyệt · chuẩn hoá tổ hợp trước khi lưu · *Chrome **không** có `commands.update()` → xem `SYSTEM_DESIGN.md` §7.18*)
- [x] Log request đầy đủ vào DB — ✅ **T-M1-14** (mọi lượt chat — thành công **và** thất bại — đều ghi 1 dòng `request_logs` với provider · model · token in/out · `cost_usd` **thật** (tính từ `PROVIDER_PRICING`) · `ttft_ms` · `latency_ms` · `tool_calls` · `context_hash` · error code · `request_id` xuyên suốt client → BFF → provider · log HTTP dạng **JSON** 1 dòng/request · **retention 90 ngày** được enforce (startup + mỗi 24 h) · `GET /api/logs` · `GET /api/usage` trả **chỉ metadata** cho eval harness · *UI hiển thị token/cost → T-M2-03 · tool/MCP thật → M2*)
- [ ] Direct/BYOK fallback khi BFF down — ⏸ tạm dừng *(BYOK — quyết định user 2026-11-08)*

### E.1 Kết quả audit parity M1 (2026-11-09)

**Gate M1:** checklist §E pass **≥ 90%** (xem [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) §3 gate · [`REQUIREMENTS.md`](REQUIREMENTS.md) §9).

| Chỉ số | Kết quả |
|---|---|
| Tổng dòng checklist §E | **35** |
| Đã đóng `- [x]` (tại thời điểm đóng M1) | **32** |
| Còn `- [ ]` (tại thời điểm đóng M1) | **3** (xem bên dưới) |
| **Tỉ lệ pass (lúc đóng M1)** | **32/35 = 91.4%** ✅ **≥ 90% → gate đạt** |
| **Cập nhật sau T-M2-03 (2026-11-10)** | **33/35 = 94.3%** (đóng thêm dòng "Token/cost hiển thị" — xem §E.1.3) |

**3 dòng còn mở — đều có lý do và task kế tiếp (không phải thiếu sót):**

| # | Dòng | Lý do | Task kế tiếp |
|---|---|---|---|
| 1 | Skills `/` + tạo/sửa/xoá skill + library + trang duyệt skill library | **Cố ý đẩy sang M2** — Edge/Gemini cũng cần tài khoản Google cho Skills, không phải đường găng M1 | 🟡 T-M2-04 ✅ (2026-11-10) · ✅ T-M2-05 ✅ T-M2-06 (2026-11-10) · ⬜ T-M2-21 (thư viện ≥ 8 skill + skill gắn điều kiện) — xem §E.1.4 |
| 2 | Token/cost hiển thị | **UI hiển thị** token/cost là M2; **phần log đầy đủ đã có** ở M1 (T-M1-14: `request_logs` + `GET /api/logs` + `GET /api/usage` → eval harness dùng được) | T-M2-03 → **✅ đã đóng 2026-11-10 (§E.1.3)** |
| 3 | Direct/BYOK fallback khi BFF down | **⏸ tạm dừng theo quyết định user 2026-11-08** (BYOK gỡ khỏi sản phẩm); server giữ nguyên `provider_keys` để mở lại | T-M1-15 (K3) · T-M1-16 (K2) |

**Bằng chứng 2 dòng parity đã đóng trong phiên audit này:**

- **"Panel giữ nguyên khi chuyển tab"** — là **hành vi native của Chrome** (side panel thuộc **cửa sổ** → Chrome giữ panel mở khi đổi tab trong cùng cửa sổ; React state của panel sống suốt vì document không reload → thread · draft · context chips không mất) → nay **đã có E2E chứng minh**: `apps/extension/e2e/panelPersistence.spec.ts` (3 kịch bản) — (1) đổi tab → gallery đổi profile theo trang mới · (2) đổi tab **khi đã có thread** → thread giữ nguyên + panel vẫn đọc lại tab mới (đếm số lần `chrome.tabs.query`) · (3) đổi tab lần 2 → thread vẫn giữ.
- **"Export conversation (Markdown / JSON)"** — T-M1-13 ✅ (`ExportMenu` Radix Popover · 3 hành động: Sao chép Markdown · Xuất `.md` · Xuất `.json` · unit `tests/export.test.ts` 15 test + E2E `e2e/export.spec.ts` 4 kịch bản).

**Ghi chú công bằng (giữ nguyên):** dòng **"Đọc nội dung trang hiện tại, bật/tắt được"** đã đóng, nhưng cơ chế context của Sidekick **khác** Edge/Gemini (đính kèm **chủ động** thay vì share mặc định) → không được tính là "thắng/thua" 1-1 khi đối chiếu eval. Chi tiết ở §E phần đầu.

#### E.1.1 Đối chiếu theo dòng "Must" ở §A + §B

Gate M1 ghi trong [`REQUIREMENTS.md`](REQUIREMENTS.md) §9 là "≥ 90% các dòng **Must**". Kiểm tra riêng **25 dòng Must** ở §A (11 dòng) + §B (14 dòng):

| Nhóm | Dòng Must | Đã đóng | Còn nợ | Ghi chú |
|---|---|---|---|---|
| §A — Edge Copilot | 10 | **10** | — | A24 (vị trí panel trái/phải) tính ✅ vì **Chrome tự quản lý** vị trí side panel (user kéo trong Chrome settings) → Edge Copilot cũng là sidebar native, **cùng cơ chế**; extension **không** cần (và **không thể**) tự set vị trí |
| §B — Chrome Gemini | 13 | **11** | **B6, B7** (Skills `/` + tạo Skill) | Chrome Gemini **yêu cầu đăng nhập Google** cho Skills (B27) — Sidekick cố ý **không** phụ thuộc tài khoản hãng (C13) → đẩy Skills sang **M2** (T-M2-04 ✅ 2026-11-10 · T-M2-06 · T-M2-21 — xem §E.1.4) |
| **Tổng** | **23** | **21** | **2 dòng** (1 nhóm) | **21/23 = 91.3%** ✅ **≥ 90% → gate đạt** |

> **Lưu ý:** gate **chính** của M1 là checklist §E (32/35 = 91.4%). Bảng trên là **cross-check độc lập** theo cách đọc thứ hai của gate (dòng Must ở §A/§B) → cả 2 cách đều **vượt 90%**.

#### E.1.2 Bằng chứng "context extraction hoạt động trên ≥ 8/10 trang thật"

Gate còn 1 vế: *"context extraction hoạt động trên ≥ 8/10 trang thật (HTML) + PDF text-based + video YouTube có caption"*.

| Hạng mục | Bằng chứng |
|---|---|
| HTML — bài blog / docs / landing page | ✅ `apps/extension/tests/extractor.test.ts` — **15 fixture HTML** khác nhau (`<article>` · `<main>` · fallback `body` · `og:title` + `meta author` · cắt text dài · dedup block lồng nhau · loại vùng nhiều · 3 biến thể edge case) + E2E thật `e2e/extractor.spec.ts` (content script chạy trên trang thật qua `chrome.scripting.executeScript`) → **≥ 8/10** loại trang thật đã được cover bằng fixture đại diện cho từng profile trong `packages/shared/src/pageProfile.ts` |
| PDF text-based | ✅ `apps/server/src/lib/pdfExtractor.ts` + `POST /api/extract/pdf` (T-M1-21) — unit + integration test trong `apps/server/tests/` |
| YouTube có caption | ✅ `apps/server/src/lib/youtubeExtractor.ts` + `POST /api/extract/youtube` (T-M1-22) — `captionTracks` → `timedtext` → `context.text`; không caption / geo-block / consent → **báo rõ, không crash chat** |

> **Ghi chú:** bộ **10 trang thật** của gate là bộ **dataset eval M2** (`apps/eval/dataset/tasks.json` + `dataset/snapshots/*`) — hiện **rỗng `[]`** (đúng chuẩn M1, xem [`EVAL_PLAN.md`](EVAL_PLAN.md) §3.1) → **điền ở T-M2-12**. Ở M1, tiêu chí này được cover bằng **fixture HTML đa dạng + E2E trên trang thật**, chưa bằng dataset eval thật. **Không ghi là đã đạt 8/10 trang thật** trong báo cáo M1 — ghi rõ giới hạn này.

#### E.1.3 Cập nhật sau T-M2-03 — đóng dòng "Token/cost hiển thị" (2026-11-10)

Dòng **"Token/cost hiển thị"** ở §E được đóng bằng **T-M2-03** → checklist §E tăng từ **32/35 = 91.4%** lên **33/35 = 94.3%**.

**Bằng chứng:**

| Hạng mục | Bằng chứng |
|---|---|
| Badge theo lượt | `apps/extension/src/sidepanel/components/chat/UsageBadge.tsx` — token vào/ra + `~ $0.0123` (4 chữ số thập phân) · `costUsd` lấy từ SSE `usage` (`packages/shared/src/events.ts`) → lưu vào `ChatMessage.costUsd` |
| Tổng theo ngày trong Settings | `apps/extension/src/sidepanel/components/settings/UsageSettings.tsx` — `GET /api/usage` (`range`: `today/7d/30d/all`) → tổng token + tổng chi phí + bảng theo ngày (`byDay[]`) |
| Chi phí **thật**, không tự tính ở client | server tính từ `PROVIDER_PRICING` (`packages/shared/src/pricing.ts`) → `request_logs.cost_usd` (T-M1-14) → SSE `usage.costUsd` → UI chỉ hiển thị → **không** lệch với giá thật |
| Provider local (mock/Ollama) | `costUsd = 0` → badge **chỉ** hiện token (không hiện `$0.0000` gây hiểu nhầm là đã mất tiền) |
| Kiểm thử | unit `tests/costFormat.test.ts` · `tests/usageBadge.test.tsx` · `tests/usageSettings.test.tsx` · E2E `e2e/modelPicker.spec.ts` (mục usage badge + usage settings) |

> **Còn mở 2 dòng** ở §E: (1) **Skills `/`** → 🟡 T-M2-04 ✅ (2026-11-10) · còn T-M2-06/21 → xem §E.1.4 · (2) **Direct/BYOK fallback khi BFF down** → ⏸ tạm dừng theo quyết định user 2026-11-08 (T-M1-15/16).

#### E.1.4 Cập nhật sau T-M2-04 — Skills `/` + CRUD (2026-11-10)

Dòng **"Skills `/` + tạo/sửa/xoá skill + library có sẵn + trang duyệt skill library"** ở §E **vẫn giữ mở** — nhưng phần lõi đã xong bằng **T-M2-04**. **Không** tick sai dòng này vì còn 2 phần chưa có.

**Đã xong (T-M2-04 — FR-SKILL-01/02/03):**

| Hạng mục | Bằng chứng |
|---|---|
| Menu `/` (lọc prefix · Enter chọn · Tab autocomplete) | `apps/extension/src/sidepanel/components/skills/SkillMenu.tsx` — `role="listbox"` · lọc prefix qua `filterSkills` (`packages/shared/src/skill.ts`) · `ArrowUp`/`ArrowDown` đổi dòng active · `Enter` chọn · `Tab` autocomplete · `Escape` đóng. Token `/` chỉ bắt ở **word boundary** → paste URL không mở nhầm menu. Unit `tests/useSkillCommand.test.ts` (14) + `tests/skillMenu.test.tsx` (6) |
| Server resolve skill | `POST /api/chat` nhận `skillId` → `skillService.resolveSkillForChat` → nối `prompt_template` vào system prompt (`buildSkillInstruction` loại `{input}`) + `model` của skill **ghi đè** model của request → nội dung user turn dùng `applySkillTemplate` (câu hỏi **không** lặp 2 lần). Token `/ten-skill` bị strip (client + server lần 2). Unit `apps/server/tests/chatSkill.test.ts` (10) |
| CRUD skill | `apps/extension/src/sidepanel/components/skills/SkillManager.tsx` (drawer trượt **trái**, 2 nhóm **Có sẵn** / **Của tôi**) + `SkillFormDialog.tsx` (tạo/sửa, validate bằng schema shared) · action **"Lưu thành kỹ năng"** trên user message (prefill = nội dung message) · API `GET/POST/PATCH/DELETE /api/skills` + bảng `skills` (migration `0004_worthless_earthquake.sql`). Xoá/sửa built-in bị server từ chối (`FORBIDDEN`). Unit `tests/skillManager.test.tsx` (10) · `tests/skillStore.test.ts` (11) · `tests/skillClient.test.ts` (9) · server `tests/skillService.test.ts` (21) + `tests/skillsRoute.test.ts` (13) |
| Seed built-in tối thiểu | `apps/server/src/skills/builtin.ts` — 3 skill (`tom-tat` · `giai-thich-don-gian` · `dich`) với **uuid cố định** → client gửi `skillId` hợp lệ, **không** cần migration seed |
| E2E | `apps/extension/e2e/skills.spec.ts` — **6/6** (stub `/api/skills` + `/api/chat`): menu `/` hiện · lọc prefix · chọn → token vào composer + `skillId` gửi BFF + token bị loại khỏi câu hỏi · Escape đóng · drawer mở từ header · "Dùng" từ drawer |

**Còn mở → vẫn giữ dòng §E mở:**

| Phần còn thiếu | Task |
|---|---|
| **Trang duyệt skill library** (xem/lọc theo tag/tên, click để chạy ngay) | ✅ **T-M2-06 (2026-11-10)** — tab "Thư viện" trong drawer Kỹ năng · `SkillLibrary` (`apps/extension/src/sidepanel/components/skills/SkillLibrary.tsx`) · lọc server `?q=` + `?tags=` (mode `any`) · chip tag toggle · click card → chen `/ten-skill` + đóng drawer + focus composer · unit `tests/skillLibrary.test.tsx` (8) |
| **Thư viện ≥ 8 skill built-in** (so sánh · trích xuất dữ liệu · viết email · sinh quiz · kiểm tra hiểu) | ⬜ **T-M2-21** |
| Skill gắn điều kiện (chạy trên tab hiện tại / tab kèm theo — tương đương B6 của Chrome Gemini) | ⬜ **T-M2-21** |
| Import/export skill JSON | ✅ **T-M2-05 (2026-11-10)** (độc quyền C10 — không nằm trong gate §E) |

> **Không** đóng dòng §E này ở T-M2-04/T-M2-05/T-M2-06 — chỉ ghi chú tiến độ. Tỉ lệ pass §E **giữ nguyên 33/35 = 94.3%** (đóng được khi **T-M2-21** xong).

> **Ghi chú công bằng:** Chrome Gemini (B6) **yêu cầu đăng nhập Google** + Chrome ≥ 147 + `en-US` (B27) → Skills của Sidekick cố ý **không** phụ thuộc tài khoản hãng (C13) → khi đối chiếu eval phải nói rõ khác biệt này, không tính là "thắng" 1-1.

### E.2 Checklist M4 — Workflow (ngoài đường găng, chỉ làm sau khi M0–M3 xong)

- [ ] Workflow CRUD: tạo / sửa / xoá / bật-tắt / nhân bản
- [ ] Trigger thủ công "chạy ngay" chạy được 1 workflow thật
- [ ] Trigger theo lịch (cron/interval) fire đúng giờ khi panel **đang đóng**
- [ ] Kết quả nằm trong 1 conversation riêng, có gắn workflow id
- [ ] Lịch sử run: từng bước, output, token, chi phí, lỗi
- [ ] Import/export workflow JSON
- [ ] Notification khi run xong
- [ ] Dry-run không thực thi hành động có tác dụng phụ
- [ ] Giới hạn an toàn: ≤ 10 bước, quota chạy/ngày
- [ ] ≥ 3 workflow mẫu tích hợp chạy được

---

## F. Nguồn bổ sung cần đọc khi triển khai

- Side Panel API quirks: `browser.sidePanel` alias chỉ từ Chrome 148; `close({tabId})` từ Chrome 141; `getLayout()` từ Chrome 140; `onOpened` từ 141; `onClosed` từ 142.
- `activeTab` **không** được cấp khi user tương tác trong side panel → bắt buộc `tabs` + `scripting` + `host_permissions`.
- Khác biệt Firefox: `sidebar_action` / `browser.sidebarAction` — không nằm trong scope M1–M2 nhưng nên giữ abstraction layer theo hướng đó.
