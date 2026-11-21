# 04. Quy chuẩn Tạo Bài Lab & Lộ trình Triển khai (MiniShop)

## 1. Quy chuẩn Thêm Một Bài Lab Mới

Chỉ cần tạo một thư mục mới trong `labs/` theo đúng mẫu bên dưới, FastAPI (`lab_loader.py`) sẽ tự động nhận diện và hiển thị bài học lên giao diện.

```text
labs/<id>-<slug>/
├── meta.json          # Khai báo thông tin, payload mẫu và bộ test verify
├── README.md          # Lý thuyết ngắn (được đóng gói khi tải snippet)
├── backend/
│   ├── vulnerable.py  # File sinh viên vá (backend)
│   └── secure.py
└── frontend/
    ├── LabView.tsx    # Giao diện sandbox — KHÔNG chứa sink nguy hiểm
    ├── vulnerable.tsx # (Tùy chọn, đi theo cặp) Sink frontend sinh viên vá — ADR-0006
    └── secure.tsx     # (Tùy chọn, đi theo cặp) Sink frontend an toàn
```

* Lỗ hổng có chủ đích chỉ được nằm trong `backend/vulnerable.py` và `frontend/vulnerable.tsx`. ESLint chặn `dangerouslySetInnerHTML` ở mọi file frontend khác ([ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md)).
* Handler cần biết "ai đang đăng nhập" thì khai báo thêm tham số `ctx` ([ADR-0005](adr/0005-lab-session-actor-context.md)).

### Mẫu `meta.json`
```json
{
  "id": "01-sql-injection",
  "title": "SQL Injection — Đăng nhập MiniShop",
  "category": "Injection",
  "difficulty": "Cơ bản",
  "summary": "Khai thác lỗi nối chuỗi f-string vào câu lệnh SQL để vượt qua bước đăng nhập tài khoản Admin.",
  "safetyPattern": "Sử dụng Parameterized Query ($1, $2 với asyncpg) để tách biệt mã lệnh SQL và dữ liệu đầu vào.",
  "samplePayloads": [
    {
      "label": "Bypass Admin Login",
      "description": "Biến điều kiện WHERE thành luôn đúng và comment phần kiểm tra mật khẩu.",
      "data": { "username": "' OR 1=1--", "password": "any" }
    },
    {
      "label": "Đăng nhập hợp lệ",
      "description": "Kiểm tra luồng đăng nhập bình thường với tài khoản khách hàng.",
      "data": { "username": "alice", "password": "password123" }
    }
  ],
  "verifyTests": [
    {
      "name": "Tài khoản hợp lệ vẫn đăng nhập được",
      "action": "login",
      "input": { "username": "alice", "password": "password123" },
      "expect": { "logged_in": true }
    },
    {
      "name": "Chặn payload SQLi cơ bản",
      "action": "login",
      "input": { "username": "' OR 1=1--", "password": "wrong" },
      "expect": { "logged_in": false }
    }
  ]
}
```

### Trường mở rộng của `meta.json` (đều tùy chọn)

| Trường | Ý nghĩa | ADR |
| :--- | :--- | :--- |
| `actors` | Danh sách username trong seed hiện trên bộ chọn persona; phần tử đầu là mặc định | [0005](adr/0005-lab-session-actor-context.md) |
| `samplePayloads[].actor` | Bấm chip payload sẽ đổi persona cùng lúc (phải nằm trong `actors`) | [0005](adr/0005-lab-session-actor-context.md) |
| `verifyTests[].actor` | Chạy test backend dưới danh tính này (phải nằm trong `actors`) | [0005](adr/0005-lab-session-actor-context.md) |
| `verifyTests[].layer` | `"backend"` (mặc định) hoặc `"frontend"` | [0006](adr/0006-frontend-sink-grading-and-verify-matchers.md) |
| `verifyTests[].component` / `props` | (Test frontend) Export trong `frontend/vulnerable.tsx` và props truyền vào | [0006](adr/0006-frontend-sink-grading-and-verify-matchers.md) |

Ví dụ test frontend cho Lab 02 Stored XSS, dùng toán tử `$contains` ([đặc tả](02-trace-and-snippet-spec.md)):

```json
{
  "name": "Payload onerror chỉ hiển thị dạng chữ, không thành thẻ HTML",
  "layer": "frontend",
  "component": "ReviewContent",
  "props": { "content": "<img src=x onerror=alert(1)>" },
  "expect": { "activeContent": false, "text": { "$contains": "<img src=x" } }
}
```

---

## 2. Danh sách Bài Lab Ánh xạ trên MiniShop & Lộ trình

### Giai đoạn 1 — MVP Khung sườn & Lab 01 (Tuần 1–2)
* [x] Dựng `docker-compose.yml` (React Vite + FastAPI + PostgreSQL + Hot Reload).
* [x] Xây dựng `source_reader.py` (parse `# @snippet`, `# @step`, tự tạo Diff & `.zip`) + API `Reset DB`.
* [x] Xây dựng UI theo **Design System** (`LabWorkspace`, `TopControlBar`, `FlowPipeline`, `CodeInspector`).
* [x] **Lab 01: SQL Injection (Đăng nhập & Tìm kiếm sản phẩm)** — Nối chuỗi `f-string` vs Parameterized Query.
* [x] Tính năng **Test My Fix** cho backend (`verifier.py`).

### Giai đoạn 2 — Bộ Bài Lab Cốt lõi (Tuần 3–4)
* [x] Triển khai [ADR-0005](adr/0005-lab-session-actor-context.md): header `X-VVWA-Actor`, `LabContext`/`ctx`, bộ chọn persona.
* [x] Triển khai [ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md) phần 1: cặp sink `frontend/vulnerable.tsx`/`secure.tsx` (source, Diff, `.zip`), `verifyTests` theo `layer`, toán tử `$contains`/`$notContains` phía backend, ESLint chặn sink.
* [x] Triển khai [ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md) phần 2: bộ chấm frontend trong document trơ, DOM probe, matcher TypeScript, `VerifyModal` gộp kết quả.
* [ ] **Lab 02: Stored XSS (Đánh giá sản phẩm)** — Render `dangerouslySetInnerHTML` trên React vs render dạng chữ (React tự escape); CSP chỉ minh họa, không chấm. *Cần ADR-0006.*
* [ ] **Lab 03: IDOR / Broken Access Control (Xem chi tiết đơn hàng)** — `GET /orders/{order_id}` không kiểm tra chủ sở hữu vs kiểm tra `order.user_id == ctx.actor.id`. *Cần ADR-0005.*
* [ ] **Lab 04: Business Logic & Client-side Trust (Giỏ hàng / Thanh toán)** — Tin tưởng `price` và `quantity` (số âm) gửi từ Frontend vs tính lại giá từ DB + validate bằng Pydantic (`gt=0`). *Cần ADR-0005.*

### Giai đoạn 3 — Mở rộng Nâng cao (Tuần 5+)
* [ ] **Lab 05: Mass Assignment (Cập nhật hồ sơ khách hàng)** — Nhận thẳng `dict` cập nhật DB (tự nâng `"role": "admin"`) vs Pydantic Schema giới hạn trường cho phép.
* [ ] **Lab 06: Path Traversal / File Upload (Tải hóa đơn & Upload ảnh sản phẩm)** — Ghép chuỗi đường dẫn file vs chuẩn hóa `Path.resolve()` + whitelist phần mở rộng.
* [ ] **Lab 07: Race Condition (Áp mã giảm giá MiniShop)** — Đọc-kiểm tra-ghi không khóa vs PostgreSQL `SELECT ... FOR UPDATE` / Atomic Update.
* [ ] **Lab 08: SSRF (Kiểm tra ảnh sản phẩm từ URL ngoài)** — `httpx.get(url)` trực tiếp vs kiểm tra allowlist domain & chặn dải IP nội bộ.
