# Hướng dẫn cài đặt & test thử toàn bộ tính năng — Sidekick AI

> Dành cho **người dùng** (không phải agent). Bản này mô tả cách cài extension, chạy hạ tầng local và **test tay từng tính năng** đã có ở M1.
>
> Ngày: 2026-11-08 · Cập nhật sau T-M1-20 + fix bundle content script.

---

## 0. Tóm tắt nhanh (nếu bạn chỉ muốn chạy thử)

```bash
# 1. Cài dependency (1 lần, hoặc sau khi pull code mới)
corepack enable pnpm     # Windows: nếu chưa có pnpm
pnpm install

# 2. Chạy Postgres
docker compose up -d

# 3. Tạo bảng
pnpm db:migrate

# 4. Build extension (tạo thư mục dist/ để load vào Chrome)
pnpm build

# 5. Mở Chrome → chrome://extensions → Bật "Developer mode" → "Load unpacked"
#    → chọn thư mục: apps/extension/dist

# 6. Mở BFF (cửa sổ terminal riêng, để nguyên)
pnpm dev:server
```

Sau đó mở Chrome, bấm **icon Sidekick AI** trên toolbar → side panel mở ra.

> **Bắt buộc:** mở `http://127.0.0.1:8787/api/health` trước. Phải trả về `{"status":"ok","db":"up",...}`. Nếu lỗi → xem mục 8 (Xử lý sự cố).

---

## 1. Yêu cầu trước khi bắt đầu

| Thứ | Cần | Ghi chú |
|---|---|---|
| Node.js | **≥ 22** | `node -v` để kiểm tra |
| pnpm | ≥ 9 | `corepack enable pnpm` |
| Docker Desktop | Đang chạy | Bắt buộc cho Postgres |
| Chrome | **≥ 114** | Cần cho Side Panel API |

---

## 2. Cài đặt chi tiết

### 2.1 Dependency

```bash
cd d:\uddn_extension_chat
corepack enable pnpm     # Chỉ 1 lần trên Windows
pnpm install
```

`packages/shared` sẽ tự build trước khi chạy lệnh khác — **không** cần `pnpm build` thủ công.

### 2.2 Database

```bash
docker compose up -d
docker compose ps        # Phải thấy sidekick-db ở trạng thái "healthy"
pnpm db:migrate
```

### 2.3 Cấu hình API key (K1 — team key)

File `apps/server/.env` đã có sẵn template đầy đủ. Kiểm tra:

```bash
# Windows PowerShell
Get-Content apps\server\.env
```

Cần có **ít nhất 1** trong 3 key sau (thứ tự ưu tiên):

| Biến | Provider | Ghi chú |
|---|---|---|
| `GROQ_API_KEY` | Groq | Free tier, ưu tiên #1 |
| `OPENROUTER_API_KEY` | OpenRouter | Nhiều model |
| `GEMINI_API_KEY` | Gemini | Google AI Studio key |

Nếu **không** có key nào → extension vẫn mở được, nhưng chat sẽ báo lỗi auth. (Ollama local không cần key — xem mục 5.9.)

> ⚠️ **Không** commit file `.env` lên git. Nó đã nằm trong `.gitignore`.

### 2.4 Chạy BFF

```bash
pnpm dev:server
```

Giữ nguyên cửa sổ này. Kiểm tra:

```bash
curl http://127.0.0.1:8787/api/health
# hoặc trên Windows:
Invoke-WebRequest -Uri http://127.0.0.1:8787/api/health -UseBasicParsing
```

Kết quả mong đợi:
```json
{"status":"ok","version":"0.1.0","db":"up","uptime":12,"providers":["groq","openrouter","gemini"]}
```

### 2.5 Build + load extension

```bash
pnpm build
```

> Lưu ý: `pnpm build` build **cả** extension lẫn server. Nếu chỉ cần extension: `pnpm build:ext`.

**Load vào Chrome:**

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc trên bên phải)
3. Bấm **Load unpacked**
4. Chọn thư mục `d:\uddn_extension_chat\apps\extension\dist`
5. Extension "Sidekick AI" sẽ xuất hiện

> 🔄 Sau mỗi lần `pnpm build`, bấm **icon reload** (↻) trên thẻ extension trong `chrome://extensions` để nạp code mới.

### 2.6 (Tuỳ chọn) Chế độ dev có hot-reload

```bash
pnpm dev:ext
```

Vite chạy ở `http://localhost:5173`. Extension có thể trỏ trực tiếp vào URL này để có HMR. **Lưu ý:** bản `dist/` (load unpacked) ổn định hơn cho việc test tính năng.

---

## 3. Mở lần đầu — Onboarding (3 bước)

Lần đầu mở panel, bạn sẽ thấy onboarding:

| Bước | Nội dung | Test gì |
|---|---|---|
| **1. Quyền** | Liệt kê quyền extension cần + nút mở trang cài đặt | Bấm "Tiếp tục" |
| **2. Provider** | Danh sách provider lấy từ `GET /api/providers` | Chọn provider có sẵn key. Provider cần key mà chưa có K1 → hiện thông báo hướng dẫn (BYOK đã tạm dừng) |
| **3. Thử** | Ô nhập + nút "Thử" → chạy SSE thật | Gõ "Xin chào" → phải nhận được câu trả lời stream |

- Bấm **"Bỏ qua"** ở bất kỳ bước nào → vào thẳng chat.
- Mở lại onboarding: nút **"?" (Hướng dẫn)** trên header panel.

---

## 4. Test tính năng Chat cốt lõi

Mở side panel (bấm icon toolbar).

### 4.1 Gửi câu hỏi + streaming

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Gõ "Xin chào, giới thiệu về bạn" | Nút gửi sáng lên khi có text |
| 2 | Nhấn **Enter** | Tin nhắn user xuất hiện, trả lời **stream từng token** |
| 3 | Nhấn **Shift+Enter** | Xuống dòng mới (không gửi) |
| 4 | Bấm nút **dừng** (hình vuông) khi đang stream | Stream dừng ngay, giữ lại phần đã nhận |
| 5 | Nhấn **Esc** trong ô nhập | Đóng popover `@` nếu đang mở |

### 4.2 Markdown, code block, bảng

Gửi prompt yêu cầu markdown, ví dụ:

```
Viết một bảng markdown 3 cột (Tên | Tuổi | Nghề nghiệp) với 3 dòng dữ liệu, và 1 đoạn code Python.
```

- [ ] Bảng hiển thị đúng, **cuộn ngang** được nếu rộng
- [ ] Code block có **nhãn ngôn ngữ** + nút **copy** → bấm copy thấy toast "Đã sao chép"
- [ ] HTML trong câu trả lời bị **sanitize** (không thực thi script)

### 4.3 Các hành động trên tin nhắn

Hover vào tin nhắn assistant:

| Nút | Test | Kỳ vọng |
|---|---|---|
| **Tạo lại** | Bấm 2 lần | Tạo **biến thể** 1/2, 2/2 — có switcher chuyển qua lại. **Không** lặp lại tin nhắn user |
| **Tiếp tục** | Bấm sau khi stream bị cắt | Nối thêm vào message cũ (UPDATE, không tạo message mới) |
| **Sửa** (trên tin nhắn user) | Sửa rồi gửi lại | Tạo **nhánh** mới; nhánh cũ nằm ở "Phiên bản cũ" |
| **Copy** | Bấm | Copy nội dung, có toast |

### 4.4 Quản lý cuộc trò chuyện

Bấm nút **lịch sử** (icon đồng hồ) trên header → drawer trượt từ **trái**:

- [ ] **Tạo** cuộc trò chuyện mới
- [ ] **Đổi tên**
- [ ] **Tìm** theo tên (ô search)
- [ ] **Ghim** → xuất hiện ở nhóm "Đã ghim"
- [ ] **Lưu trữ** → nhóm "Đã lưu trữ"
- [ ] **Xoá** → có dialog xác nhận
- [ ] Bấm 1 cuộc trò chuyện → **tải lại lịch sử kèm citations đã lưu**

### 4.5 Trạng thái & lỗi

| Tình huống | Cách test | Kỳ vọng |
|---|---|---|
| Lịch sử đang tải | Mở 1 cuộc trò chuyện cũ | Skeleton (không màn hình trắng) |
| Màn hình trống | Bấm nút **xoá** trên header | Hiện `PromptGallery` với gợi ý theo trang |
| BFF offline | **Tắt Docker** hoặc đổi endpoint sai | Badge "Offline" + banner đỏ dưới header |
| Lỗi 429 | Tạo tình huống rate limit | Card lỗi có **đếm ngược** rồi bật nút "Thử lại" |
| Lỗi 401 | Xoá API key trong `.env`, restart server | Hành động "Kiểm tra API key" → mở Settings |
| Lỗi 5xx / mạng | Tắt server giữa lúc chat | Nút "Thử lại"; **retry tự động 1 lần** |

---

## 5. Test tính năng Context (đọc trang web)

> Nguyên tắc quan trọng: **context chỉ được gửi khi bạn chủ động đính kèm.** Không đính kèm gì → chat thuần LLM.

### 5.1 Gợi ý theo trang + Tóm tắt 1-click

Mở một trang bài viết/docs:

- [ ] `PromptGallery` hiện **≥ 3 gợi ý đổi theo loại trang** (docs / bài báo / forum / video / pdf / shopping)
- [ ] Nút **refresh** xoay vòng gợi ý (deterministic trong cùng profile)
- [ ] Nút **"Tóm tắt trang này"** → tự đính kèm trang hiện tại rồi gửi prompt tóm tắt
- [ ] Trên `chrome://` (không đọc được) → hiện 4 gợi ý chung, **không** có nút tóm tắt

### 5.2 Đính kèm thủ công

- [ ] Bấm chip nguồn trong composer → **tự đính kèm** trang hiện tại
- [ ] Bấm **"X"** trên chip → bỏ đính kèm
- [ ] Gõ **`@`** trong ô nhập → popover danh sách tab (title + favicon), chọn được **nhiều** tab
- [ ] Chip hiện **ngân sách token**: "đã dùng X/Y token"

### 5.3 Bôi đen (selection)

- [ ] Bôi đen trên trang → nút nổi **"Hỏi Sidekick"** xuất hiện
- [ ] Bấm nút → panel tự mở (nếu đang đóng) + chip selection
- [ ] Panel **đang mở** → dùng nút **"Dính đoạn đã chọn"**
- [ ] Đoạn chọn có `tier: 'selection'` → **ưu tiên cao nhất** trong ngân sách
- [ ] Panel đóng lúc bôi đen → đoạn **chờ** (TTL 5 phút) → mở panel sau thì tự nhận

### 5.4 Trích dẫn (citation)

Gửi câu hỏi có context để LLM trích dẫn:

- [ ] Chip nguồn inline trong câu trả lời (đánh số **1-based**)
- [ ] Bấm chip → popover hiện **đoạn nguồn** + nút "Mở trang gốc"
- [ ] Danh sách nguồn tóm tắt dưới bubble

### 5.5 Ngân sách & cắt bớt context

- [ ] Hiện "đã dùng X/Y token" trong chip
- [ ] Đính kèm nhiều tab → context bị **cắt theo thứ tự ưu tiên**: selection > tab đính kèm > tab hiện tại > lịch sử chat

### 5.6 PDF & YouTube

| Loại | Test | Kỳ vọng |
|---|---|---|
| **PDF text-based** | Mở 1 PDF công khai → đính kèm | Nội dung được trích thành `context.text` |
| **PDF scan (ảnh)** | Mở PDF scan | Báo rõ "không đọc được, hãy upload ảnh" — **không** crash |
| **YouTube** | Mở video có caption → đính kèm | Transcript được lấy |
| **YouTube không caption / geo-block** | Video bị chặn | Báo rõ lý do, chat vẫn chạy |

### 5.7 Cache context

- [ ] Đọc 1 trang → đóng → mở lại cùng trang → **không** trích xuất lại (dùng cache, TTL 30 phút)
- [ ] Trang lỗi → fallback về bản cache

---

## 6. Test tính năng Ảnh (vision)

- [ ] Bấm nút **ảnh** (icon 🖼 cạnh ô nhập) → file picker chọn ảnh → **thumbnail hiện trong tray**
- [ ] **Paste** ảnh từ clipboard vào ô nhập → cũng được đính kèm
- [ ] **Kéo thả** ảnh vào composer → được đính kèm (trang **không** bị điều hướng đi)
- [ ] Xoá ảnh khỏi tray → không còn gửi đi
- [ ] Gửi → request có `attachments` + tin nhắn hiển thị ảnh
- [ ] **Giới hạn**: 5 MB/ảnh, 4 ảnh/lượt → vượt thì báo lỗi
- [ ] File không phải ảnh → báo lỗi, không gửi

---

## 7. Test Settings (nút ⚙ trên header)

Drawer trượt từ **phải**. Mọi thay đổi áp dụng **ngay, không cần reload**.

| Section | Test | Kỳ vọng |
|---|---|---|
| **Giao diện (theme)** | Chọn sáng / tối / theo OS | `<html>` có class `.dark` đổi ngay; **reload vẫn giữ** |
| **Hiển thị** | Cỡ chữ 4 mức · mật độ 3 mức · bề rộng 3 mức | `--font-scale` / `--density-scale` / `--panel-max-width` đổi; không sửa component nào |
| **Quyền riêng tư** | Telemetry + history | Mặc định **OFF** |
| **Quản lý dữ liệu** | Xoá lịch sử chat | Có **confirm** → `DELETE /api/conversations` |
| | Xoá dữ liệu cục bộ | Xoá theo prefix `sidekick.` nhưng **giữ** onboarding |
| | Import / export JSON | Round-trip đúng |
| **Máy chủ (BFF)** | Sửa URL → lưu | Validate qua `GET <url>/api/health` **trước** khi lưu |
| **Ngôn ngữ** | VI ↔ EN | UI đổi **ngay** (không reload); reload vẫn giữ; **nhãn context menu + nút nổi content script cũng đổi** |
| **Phím tắt** | Xem mục 8 | 2 lớp |

---

## 8. Test phím tắt (T-M1-18)

Settings → section **"Phím tắt"**. Có **2 lớp**:

### Lớp 1 — Shortcut native của Chrome

- [ ] Hiện shortcut đang gán (đọc bằng `chrome.commands.getAll()`) — mặc định `Ctrl+Shift+K`
- [ ] Bấm nút **"Mở trang phím tắt"** → mở `chrome://extensions/shortcuts`
- [ ] Đổi ở trang đó → quay lại Settings thấy giá trị mới

> ℹ️ **Giới hạn Chrome MV3:** Chrome **không** có `chrome.commands.update()` / `reset()` (đó là API riêng của Firefox) → extension **không** tự đổi được shortcut gốc. Đó là lý do thiết kế 2 lớp.

### Lớp 2 — Shortcut nhanh của Sidekick

- [ ] Bấm **"Đổi"** → bấm tổ hợp phím → hiện giá trị mới, có toast
- [ ] **Reload** → giá trị **vẫn còn** (lưu `chrome.storage.local`)
- [ ] Bấm **"Về mặc định"** → xoá shortcut tự do → quay về mặc định
- [ ] Thử gán tổ hợp **trùng deny-list** (ví dụ `Ctrl+T`, `Ctrl+W`, `Ctrl+N`) → báo lỗi "reserved"
- [ ] Bấm `Esc` khi đang bắt phím → huỷ, không lưu

---

## 9. Test mở/toggle panel + context menu

| Cách | Test | Kỳ vọng |
|---|---|---|
| **Toolbar icon** | Bấm icon Sidekick AI | Panel **toggle** mở/đóng (Chrome tự xử lý) |
| **Phím tắt** | `Ctrl+Shift+K` (macOS: `Cmd+Shift+K`) | Mở/đóng panel |
| **Context menu — trang** | Chuột phải trên trang → "Mở Sidekick AI" | Mở panel |
| **Context menu — chọn đoạn** | Bôi đen → chuột phải → "Hỏi Sidekick với đoạn đã chọn" | Đoạn vào context `tier: 'selection'` + mở panel |

> Lưu ý: `chrome.sidePanel.open()` chỉ chạy được trong **user gesture** (click / context menu / phím tắt) — đúng như thiết kế.

---

## 10. Test responsive + accessibility (T-M1-20)

### Responsive

1. Mở side panel → kéo **cạnh trái** của panel để thu nhỏ
2. Thử các bề rộng: **320px · 480px · 640px**

- [ ] **Không có thanh cuộn ngang** ở cả 3 mức
- [ ] Drawer Settings (`w-[min(360px,92vw)]`) không tràn ngang
- [ ] Drawer danh sách cuộc trò chuyện + dialog xác nhận không tràn ngang
- [ ] Chip nguồn không tràn (`max-w-[min(180px,100%)]`)
- [ ] Bubble tin nhắn + textarea co lại đúng (không phình ngang)
- [ ] Header + composer vẫn nhìn thấy đủ ở 320px

### Accessibility

- [ ] **Tab** vào panel → thấy **skip-link** "Bỏ qua tới ô nhập" → Enter → con trỏ nhảy vào ô nhập
- [ ] Focus ring rõ ở **mọi** phần tử tương tác (Tab đi qua và quan sát)
- [ ] **Mọi** icon-button có `aria-label` (đọc bằng screen reader, ví dụ NVDA / VoiceOver)
- [ ] Streaming: screen reader đọc **phần vừa sinh** — **không** đọc lại toàn bộ lịch sử chat
- [ ] Icon trang trí bị bỏ qua (không đọc "image")
- [ ] Mọi icon-button **≥ 24×24px** (WCAG 2.2 §2.5.8)
- [ ] `prefers-reduced-motion` → animation bị tắt (bật trong `chrome://settings/appearance` → "Giảm chuyển động")
- [ ] Dialog: `Esc` đóng, focus kẹt bên trong, focus trả về nút đã bấm

---

## 11. Test log & định giá (để chuẩn bị M2 eval)

Mỗi lượt chat (thành công **và** thất bại) đều ghi 1 dòng vào bảng `request_logs`:

```bash
curl http://127.0.0.1:8787/api/logs
curl http://127.0.0.1:8787/api/usage
```

Kiểm tra trực tiếp trong Postgres:

```bash
docker exec -it sidekick-db psql -U sidekick -d sidekick -c \
  "SELECT provider, model, tokens_in, tokens_out, cost_usd, ttft_ms, latency_ms, request_id FROM request_logs ORDER BY created_at DESC LIMIT 10;"
```

Cột cần chú ý:

| Cột | Ý nghĩa |
|---|---|
| `provider` / `model` | Provider thực sự xử lý |
| `tokens_in` / `tokens_out` | Token đã dùng |
| `cost_usd` | Chi phí **ước lượng** theo bảng giá snapshot (không phải hoá đơn) |
| `ttft_ms` | Time-to-first-token |
| `latency_ms` | Tổng độ trễ |
| `context_hash` | Hash của context **thật đã gửi** — đổi câu hỏi **không** đổi hash |
| `request_id` | UUID xuyên suốt client → BFF → provider (hiện 6 ký tự ở dòng meta của bubble assistant) |

> `request_id` trong DB phải **khớp tuyệt đối** với `request_id` hiện trên bubble trong panel.

---

## 11b. Test Model picker + fallback + chi phí (M2 — T-M2-02 / T-M2-03)

> Mục mới thêm 2026-11-10. Chi tiết kỹ thuật: [`SYSTEM_DESIGN.md`](SYSTEM_DESIGN.md) §7.22 (model picker + fallback) · §7.23 (token & chi phí).

### 11b.1 Model picker (T-M2-02)

Nút **"Chọn mô hình AI"** (icon ⇅) nằm cạnh chip provider ở header panel.

- [ ] Bấm nút → hiện popover: danh sách **provider** (chỉ provider `available`) + danh sách **model**
- [ ] Chọn 1 provider → danh sách model đổi theo provider đó
- [ ] Provider có **> 12 model** → hiện ô **"Tìm mô hình…"** → gõ từ khoá → danh sách lọc đúng
- [ ] Chọn 1 model → nút trigger đổi nhãn hiển thị
- [ ] **Đổi provider** → model đã chọn bị **xoá** (không giữ model của provider khác)
- [ ] Bấm **"Về mặc định"** → xoá lựa chọn → lượt chat sau dùng provider/model mặc định của BFF
- [ ] **Reload panel** → lựa chọn **vẫn còn** (lưu `chrome.storage.local` key `sidekick.modelSelection`)
- [ ] Gửi câu hỏi → chip provider ở header hiện provider/model **thật sự** đã trả lời
- [ ] Đổi model giữa cuộc trò chuyện → **lịch sử không mất**
- [ ] Provider không có key / API lỗi → hiện dòng cảnh báo *"Danh sách mô hình có thể cũ…"* và vẫn chọn được model từ danh sách tĩnh

### 11b.2 Fallback khi provider lỗi (T-M2-02)

Fallback **chỉ** xảy ra khi provider lỗi **tạm thời** (429 / 5xx / network) **và** chưa phát token nào.

Cách kiểm chứng nhanh nhất (không cần sập provider thật):

```bash
# 1. Tạm dừng key của provider đang dùng trong apps/server/.env, đổi sang provider khác làm dự phòng
# 2. Restart BFF, reload extension
```

- [ ] Provider chính lỗi **429 / 5xx** → server tự thử provider dự phòng → **toast** "Đã chuyển sang provider X" hiện lên
- [ ] Chip provider ở header **đổi** sang provider dự phòng
- [ ] Nội dung trả lời **không bị trùng lặp** (fallback chỉ khi chưa stream token nào)
- [ ] Provider lỗi **401 / 403** → **không** fallback, hiện lỗi "Kiểm tra API key" như cũ
- [ ] Kiểm tra log:

```bash
docker exec -it sidekick-db psql -U sidekick -d sidekick -c \
  "SELECT provider, model, fallback_from, error FROM request_logs ORDER BY created_at DESC LIMIT 10;"
```

- [ ] Lượt đã fallback → cột `fallback_from` có tên provider **đã lỗi**; lượt bình thường → `fallback_from` = `NULL`

### 11b.3 Token & chi phí (T-M2-03)

- [ ] Sau mỗi lượt chat → dưới bubble assistant có badge `↑ … ↓ … token`
- [ ] Với provider **trả phí** (Groq / OpenRouter / Gemini) → badge có thêm `~ $0.0123` (**4** chữ số thập phân)
- [ ] Với provider **local** (Ollama / mock) → badge **chỉ** hiện token, **không** hiện `$0.0000`
- [ ] Lượt chat chưa xong (chưa có event `usage`) → badge **chưa** hiện (không render rỗng)
- [ ] Mở **Settings ⚙** → section **"Chi phí & sử dụng"** → hiện tổng token + tổng chi phí
- [ ] Section có **bảng theo ngày** (ngày · lượt chat · token · chi phí)
- [ ] Đổi khoảng thời gian `Hôm nay / 7 ngày / 30 ngày / Tất cả` → số liệu đổi theo
- [ ] Bấm **"Làm mới"** → gọi lại API → số liệu cập nhật
- [ ] BFF tắt → section hiện thông báo lỗi, **không** crash drawer

> Chi phí là **ước lượng** theo bảng giá snapshot (`PROVIDER_PRICING`), không phải hoá đơn → số liệu giữa các provider có thể lệch nhẹ.

---

## 12. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `pnpm: command not found` | Chưa bật corepack | `corepack enable pnpm` rồi mở terminal mới |
| Docker daemon không chạy | Docker Desktop chưa start | Mở Docker Desktop, đợi `docker compose ps` hiện `healthy` |
| `Cau hinh moi truong khong hop le` | `.env` thiếu `DATABASE_URL` | So sánh với `apps/server/.env.example` |
| `/api/health` → `db: "down"` | Postgres chưa sẵn sàng | `docker compose ps` → đợi `healthy` → `pnpm db:migrate` |
| `/api/usage` trả **500** | Docker Desktop đã tắt → mất Postgres | Mở Docker Desktop → `docker compose up -d` → `docker compose ps` (container `sidekick-db` phải `healthy`) |
| Panel mở nhưng chat báo lỗi auth | Thiếu API key | Thêm key vào `apps/server/.env` → **restart** `pnpm dev:server` |
| Panel báo "Offline" | BFF chết | Kiểm tra terminal `pnpm dev:server` còn chạy không |
| Extension không load được | Chưa build | Chạy `pnpm build` → load `apps/extension/dist` |
| Extension "lỗi" sau khi sửa code | Chưa reload | `chrome://extensions` → bấm ↻ |
| Content script không chạy trên trang | `chrome://` hoặc trang store của Chrome | Đó là **giới hạn của Chrome**, không phải bug |
| Lỗi CORS trong console | `ALLOWED_ORIGINS` thiếu origin | Thêm origin vào `ALLOWED_ORIGINS` trong `.env` |

---

## 13. Chạy test tự động (nếu bạn muốn tự kiểm tra)

```bash
pnpm typecheck     # kiểm tra kiểu
pnpm lint          # ESLint
pnpm test          # 1394 unit test
pnpm build         # build tất cả
pnpm test:e2e      # 91 test Playwright (cần Docker + BFF chạy)
```

### 13b. Script chạy checklist "test tay" tự động (M2)

Ngoài checklist bằng tay ở §11b, có **script tự động hoá** chính phần test tay đó:
load extension **unpacked** vào Chrome thật → đi từng mục → **lưu ảnh chụp** làm bằng chứng.

```bash
# Điều kiện: Docker Desktop chạy + BFF chạy (pnpm dev:server) + đã build extension
pnpm build
pnpm manual:checklist
```

- Script: [`scripts/manual-checklist.mjs`](../scripts/manual-checklist.mjs)
- Ảnh chụp: `artifacts/manual-test/*.png` (thư mục này **không** commit)
- Script **không** dùng profile Chrome của bạn → an toàn, chạy song song với Chrome đang mở được.

| Mục | Kiểm tra | Kết quả lần chạy gần nhất (2026-11-10) |
|---|---|---|
| 11b.1-1 | Danh sách provider (chỉ `available`) | ✅ 4 mục |
| 11b.1-2 | Model **động** theo provider | ✅ `openrouter` → **428 model** (live) |
| 11b.1-3 | Ô tìm kiếm khi > 12 model | ✅ lọc `428 → 7` model |
| 11b.1-4 | Chọn model → lưu `chrome.storage.local` | ✅ `openrouter · thinkingmachines/inkling-2-small:free` |
| 11b.1-5 | "Về mặc định" → xoá lựa chọn | ✅ |
| 11b.3-1 | Badge token dưới bubble assistant | ✅ `↑ 124 ↓ 212 token` |
| 11b.3-2 | Badge có chi phí USD | ✅ `$0.0002` |
| 11b.3-3 | Tổng token + tổng chi phí | ✅ `65,190` token · `$0.0374` |
| 11b.3-4 | Bảng theo ngày | ✅ 4 dòng |
| 11b.3-5 | Bộ chọn khoảng thời gian | ✅ 4 nút (`Hôm nay / 7 ngày / 30 ngày / Tất cả`) |
| 11b.3-6 | Khoảng "Hôm nay" | ✅ `60,838` token (≠ tổng → lọc đúng) |
| 11b.3-7 | Khoảng "Tất cả" | ✅ `65,190` token (= tổng) |
| 11b.3-8 | Nút "Làm mới" | ✅ không lỗi |
| 11b.2-1 | SSE `provider_switch` (live) | ✅ `ollama → groq` |
| 11b.2-2 | `request_logs.fallback_from` | ✅ `provider="groq" fallback_from="ollama"` |

> **Cách script kiểm chứng fallback (§11b.2):** nó khởi động một **BFF phụ** ở port `8791` với `DEFAULT_PROVIDER=ollama` (Ollama không chạy → lỗi network **retryable**) + `PROVIDER_FALLBACKS=groq,openrouter` → rồi gửi 1 lượt chat và đọc lại `GET /api/logs`. BFF phụ được tắt ngay sau khi kiểm tra.

---

## 14. Danh sách tính năng đã có (M1 — 23/25 task)

| Nhóm | Tính năng |
|---|---|
| **Mở panel** | Toolbar icon · `Ctrl+Shift+K` · context menu (2 mục) |
| **Chat** | Streaming SSE · Markdown/code/table + copy · regenerate/edit-resend/stop/continue · biến thể + nhánh · draft tự lưu · 4 trạng thái (loading/empty/error/offline) + retry + badge kết nối |
| **Context** | Đọc trang (HTML/PDF/YouTube) · đính kèm thủ công · `@` multi-tab · bôi đen · ngân sách + cắt bớt · cache 30 phút · citation chip + popover |
| **Ảnh** | Chọn/paste/kéo-thả · preview · xoá · giới hạn 5 MB × 4 |
| **Hội thoại** | CRUD + ghim + lưu trữ + search · tải lại kèm citations |
| **Cài đặt** | Theme · cỡ chữ/mật độ/bề rộng · riêng tư · quản lý dữ liệu · endpoint BFF · **i18n VI/EN** · **phím tắt 2 lớp** · **chi phí & sử dụng theo ngày** |
| **Onboarding** | 3 bước, skippable, mở lại được |
| **Responsive + a11y** | 320–640px không tràn · focus ring chuẩn · live region · skip-link · tap target 24px |
| **Quan sát** | `request_logs` đầy đủ (token/cost/ttft/latency/hash/request-id/fallback_from) + API đọc metadata |
| **M2 (2026-11-10)** | **Model picker động** (chọn provider + model, persist, search) · **fallback chain runtime** (tự chuyển provider + toast + log `fallback_from`) · **token & chi phí** (badge theo lượt + tổng theo ngày trong Settings) |

### Chưa có (để biết khi nào phàn nàn)

| Tính năng | Trạng thái |
|---|---|
| Export cuộc trò chuyện (Markdown/JSON) | ✅ T-M1-13 — **đã có** |
| BYOK (người dùng tự mang key) | ⏸ **tạm dừng** theo quyết định của bạn |
| Skills / MCP / RAG / web search / workflow | ⬜ thuộc **M2–M4** |
| Thêm provider OpenAI / Anthropic | ⬜ T-M2-01 — **đẩy lại** (quyết định 2026-11-10) |
| Budget cap (cảnh báo / chặn khi vượt ngưỡng) | ⬜ T-M2-03b — FR-PROVIDER-06, priority C |
| Model picker + fallback chain | ✅ T-M2-02 — **đã có** |
| Token & cost calculator trong UI | ✅ T-M2-03 — **đã có** |

---

## 15. Checklist "đã test hết" để đánh dấu

```
[ ] 1.  Cài đặt xong, /api/health trả về ok
[ ] 2.  Load extension vào Chrome, panel mở được
[ ] 3.  Onboarding 3 bước chạy được
[ ] 4.  Chat stream hoạt động, dừng được
[ ] 5.  Markdown / code / copy / bảng đều đúng
[ ] 6.  Regenerate / edit-resend / continue / copy
[ ] 7.  CRUD cuộc trò chuyện + ghim + search
[ ] 8.  Context: gợi ý theo trang + tóm tắt + chip + @ + bôi đen
[ ] 9.  Citation chip + popover
[ ] 10. PDF + YouTube
[ ] 11. Upload ảnh (chọn / paste / kéo-thả)
[ ] 12. Settings: theme, hiển thị, riêng tư, dữ liệu, endpoint, ngôn ngữ
[ ] 13. Phím tắt: 2 lớp, đổi, persist, reset, deny-list
[ ] 14. Mở panel: toolbar / Ctrl+Shift+K / context menu
[ ] 15. Responsive 320 / 480 / 640 không tràn ngang
[ ] 16. a11y: skip-link, focus ring, aria-label, live region
[ ] 17. request_logs có đủ cột + request_id khớp bubble
[ ] 18. Chạy pnpm test / test:e2e xanh
[ ] 19. Model picker: mở, chọn provider + model, đổi provider xoá model, search, persist qua reload
[ ] 20. Fallback: provider lỗi 429/5xx → toast + đổi chip provider + log fallback_from; 401 → không fallback
[ ] 21. Chi phí: badge token/cost dưới bubble + section "Chi phí & sử dụng" (tổng + bảng theo ngày + làm mới)
```

> **Mục 19–21 đã được kiểm chứng tự động** bằng `pnpm manual:checklist` (xem §13b) — **15/15 pass** ngày 2026-11-10 trên Chrome thật + BFF thật + Postgres thật. Checklist này vẫn nên bấm tay 1 lần để xác nhận trải nghiệm người dùng (đặc biệt là **toast** "Đã chuyển sang provider X" — script kiểm tra được event `provider_switch` nhưng không quan sát được toast render).
