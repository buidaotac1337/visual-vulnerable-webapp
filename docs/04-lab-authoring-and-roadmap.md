# 04. Quy chuẩn Tạo Bài Lab & Lộ trình Triển khai (MiniShop)

## 1. Quy chuẩn Thêm Một Bài Lab Mới

Chỉ cần tạo một thư mục mới trong `labs/` theo đúng mẫu bên dưới, FastAPI (`lab_loader.py`) sẽ tự động nhận diện và hiển thị bài học lên giao diện.

```text
labs/<id>-<slug>/
├── meta.json          # Khai báo thông tin, payload mẫu và bộ test verify
├── README.md          # Lý thuyết ngắn (được đóng gói khi tải snippet)
├── backend/
│   ├── vulnerable.py
│   └── secure.py
└── frontend/
    └── LabView.tsx
```

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

---

## 2. Danh sách Bài Lab Ánh xạ trên MiniShop & Lộ trình

### Giai đoạn 1 — MVP Khung sườn & Lab 01 (Tuần 1–2)
* [ ] Dựng `docker-compose.yml` (React Vite + FastAPI + PostgreSQL + Hot Reload).
* [ ] Xây dựng `source_reader.py` (parse `# @snippet`, `# @step`, tự tạo Diff & `.zip`) + API `Reset DB`.
* [ ] Xây dựng UI theo **Design System** (`LabWorkspace`, `TopControlBar`, `FlowPipeline`, `CodeInspector`).
* [ ] **Lab 01: SQL Injection (Đăng nhập & Tìm kiếm sản phẩm)** — Nối chuỗi `f-string` vs Parameterized Query.

### Giai đoạn 2 — Bộ Bài Lab Cốt lõi (Tuần 3–4)
* [ ] **Lab 02: Stored XSS (Đánh giá sản phẩm)** — Render `dangerouslySetInnerHTML` trên React vs Escape/DOMPurify + CSP.
* [ ] **Lab 03: IDOR / Broken Access Control (Xem chi tiết đơn hàng)** — `GET /orders/{order_id}` không kiểm tra chủ sở hữu vs kiểm tra `order.user_id == current_user.id`.
* [ ] **Lab 04: Business Logic & Client-side Trust (Giỏ hàng / Thanh toán)** — Tin tưởng `price` và `quantity` (số âm) gửi từ Frontend vs tính lại giá từ DB + validate bằng Pydantic (`gt=0`).
* [ ] Hoàn thiện tính năng **Test My Fix** (`verifier.py`).

### Giai đoạn 3 — Mở rộng Nâng cao (Tuần 5+)
* [ ] **Lab 05: Mass Assignment (Cập nhật hồ sơ khách hàng)** — Nhận thẳng `dict` cập nhật DB (tự nâng `"role": "admin"`) vs Pydantic Schema giới hạn trường cho phép.
* [ ] **Lab 06: Path Traversal / File Upload (Tải hóa đơn & Upload ảnh sản phẩm)** — Ghép chuỗi đường dẫn file vs chuẩn hóa `Path.resolve()` + whitelist phần mở rộng.
* [ ] **Lab 07: Race Condition (Áp mã giảm giá MiniShop)** — Đọc-kiểm tra-ghi không khóa vs PostgreSQL `SELECT ... FOR UPDATE` / Atomic Update.
* [ ] **Lab 08: SSRF (Kiểm tra ảnh sản phẩm từ URL ngoài)** — `httpx.get(url)` trực tiếp vs kiểm tra allowlist domain & chặn dải IP nội bộ.
