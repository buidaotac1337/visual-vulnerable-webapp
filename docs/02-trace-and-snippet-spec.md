# 02. Đặc tả Kỹ thuật: Trace, Highlight & Snippet (FastAPI)

Tài liệu này quy định chuẩn giao tiếp giữa **FastAPI** và **React** để đảm bảo tính năng **sáng đèn dòng code**, **so sánh Diff** và **tải snippet** hoạt động chính xác 100% kể cả khi sinh viên tự sửa file trên máy.

---

## 1. Quy chuẩn API Endpoint (FastAPI)

| Nhóm | Method & Endpoint | Chức năng |
| :--- | :--- | :--- |
| **Hệ thống** | `GET /api/labs` | Trả về danh sách toàn bộ bài lab quét từ `labs/*/meta.json` |
| **Hệ thống** | `POST /api/system/reset-db` | Khôi phục toàn bộ bảng MiniShop về trạng thái sạch ban đầu |
| **Thực thi Lab** | `POST /api/labs/{lab_id}/{mode}/{action}` | Chạy logic bài lab (`mode`: `vulnerable` hoặc `secure`) |
| **Mã nguồn** | `GET /api/labs/{lab_id}/source` | Đọc file thật (`vulnerable.py`, `secure.py`, `LabView.tsx`) + bản đồ dòng `@step` |
| **Tải Snippet** | `GET /api/labs/{lab_id}/download` | Đóng gói động và tải về file `<lab_id>-fastapi.zip` |
| **Tự kiểm thử** | `POST /api/labs/{lab_id}/verify` | Chạy bộ test trong `meta.json` vào endpoint `vulnerable` để chấm bản vá của sinh viên |

---

## 2. Chuẩn JSON Response & Execution Trace (Hiệu ứng "Sáng đèn")

Mọi endpoint bài lab trả về một cấu trúc JSON thống nhất gồm `data`, `meta` và mảng `trace`. Frontend sẽ phát animation sáng đèn từng bước theo mảng `trace` (mặc định `600ms/bước`, hỗ trợ *Replay* và *Step-by-step*).

```json
{
  "ok": true,
  "data": {
    "logged_in": true,
    "user": { "id": 1, "username": "admin", "role": "admin" }
  },
  "meta": {
    "lab_id": "01-sql-injection",
    "mode": "vulnerable",
    "outcome": "exploited"
  },
  "trace": [
    {
      "step": 1,
      "layer": "frontend",
      "tag": "fe-submit",
      "status": "info",
      "title": "Gửi yêu cầu đăng nhập MiniShop",
      "detail": "POST /api/labs/01-sql-injection/vulnerable/login với username = \"' OR 1=1--\""
    },
    {
      "step": 2,
      "layer": "backend",
      "tag": "build-query",
      "status": "danger",
      "title": "Nối chuỗi trực tiếp bằng f-string",
      "detail": "SELECT id, username, role FROM users WHERE username = '' OR 1=1--' AND password_hash = '...'"
    },
    {
      "step": 3,
      "layer": "database",
      "tag": "exec-query",
      "status": "danger",
      "title": "PostgreSQL thực thi câu lệnh bị tiêm",
      "detail": "Mệnh đề OR 1=1 luôn đúng -> trả về tài khoản admin mà không cần mật khẩu."
    }
  ]
}
```

### Quy ước `status` trong Trace
* `info` — Bước xử lý bình thường.
* `warning` — Dữ liệu chưa được kiểm tra / tiềm ẩn rủi ro.
* `danger` — Lỗ hổng vừa kích hoạt hoặc bị khai thác thành công.
* `safe` — Safety Pattern đã chặn đứng payload độc hại.

---

## 3. Single Source of Truth & Chống Lệch Dòng (`# @step` & `# @snippet`)

Thay vì hardcode số dòng cố định (sẽ bị sai ngay khi sinh viên gõ thêm dòng mới), ta đặt comment đánh dấu ngay trong file Python thật:

### Ví dụ `labs/01-sql-injection/backend/vulnerable.py`

```python
# @snippet:start
async def login(payload: dict, db):
    username = payload.get("username", "")
    password = payload.get("password", "")

    # @step:build-query
    sql = f"SELECT id, username, role FROM users WHERE username = '{username}' AND password_hash = '{password}'"

    # @step:exec-query
    row = await db.fetch_one(sql)

    return {
        "data": {"logged_in": row is not None, "user": dict(row) if row else None},
        "meta": {"outcome": "exploited" if row and row["role"] == "admin" else "normal"},
        "trace": [
            {"layer": "backend", "tag": "build-query", "status": "danger",
             "title": "Nối chuỗi f-string", "detail": f"SQL thực tế: {sql}"},
            {"layer": "database", "tag": "exec-query", "status": "danger" if row else "info",
             "title": "PostgreSQL thực thi", "detail": f"Kết quả: {dict(row) if row else 'Không tìm thấy'}"}
        ]
    }
# @snippet:end
```

### Ví dụ `labs/01-sql-injection/backend/secure.py`

```python
# @snippet:start
async def login(payload: dict, db):
    username = payload.get("username", "")
    password = payload.get("password", "")

    # @step:build-query
    sql = "SELECT id, username, role FROM users WHERE username = $1 AND password_hash = $2"

    # @step:exec-query
    row = await db.fetch_one(sql, username, password)

    return {
        "data": {"logged_in": row is not None, "user": dict(row) if row else None},
        "meta": {"outcome": "blocked" if not row else "normal"},
        "trace": [
            {"layer": "backend", "tag": "build-query", "status": "safe",
             "title": "Parameterized Query ($1, $2)", "detail": "Tách biệt hoàn toàn cấu trúc SQL và dữ liệu người dùng."},
            {"layer": "database", "tag": "exec-query", "status": "safe",
             "title": "PostgreSQL bind tham số an toàn", "detail": f"Tìm đúng chuỗi literal username={username!r}."}
        ]
    }
# @snippet:end
```

### Cách `source_reader.py` hoạt động
1. Đọc trực tiếp file trên đĩa -> phản ánh tức thì mọi thay đổi của sinh viên.
2. Trích xuất phần nằm giữa `# @snippet:start` và `# @snippet:end` (ẩn boilerplate).
3. Ánh xạ mỗi `# @step:<tag>` sang **số dòng thực tế** của dòng code ngay bên dưới, sau đó ẩn dòng comment `# @step:...` khi hiển thị trên UI.
4. Trả về cả `vulnerable`, `secure` và `diff` (tạo tự động bằng `difflib.unified_diff` của Python).

---

## 4. Đặc tả Gói Snippet Tải Về (`.zip`)

Khi bấm **"Tải Snippet"**, FastAPI dùng `zipfile` + `io.BytesIO` tạo file `<lab_id>-fastapi.zip` trực tiếp trong bộ nhớ gồm:

```text
01-sql-injection-fastapi.zip
├── vulnerable.py          # Bản có lỗ hổng (kèm comment giải thích)
├── secure.py              # Bản áp dụng safety pattern
├── diff.patch             # Khác biệt giữa 2 bản (tạo tự động)
└── README.md              # Tóm tắt lỗ hổng, payload mẫu & hướng dẫn tự chạy
```
