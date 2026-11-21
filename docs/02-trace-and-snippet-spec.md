# 02. Đặc tả Kỹ thuật: Trace, Highlight & Snippet (FastAPI)

Tài liệu này quy định chuẩn giao tiếp giữa **FastAPI** và **React** để đảm bảo tính năng **sáng đèn dòng code**, **so sánh Diff** và **tải snippet** hoạt động chính xác 100% kể cả khi sinh viên tự sửa file trên máy.

---

## 1. Quy chuẩn API Endpoint (FastAPI)

| Nhóm | Method & Endpoint | Chức năng |
| :--- | :--- | :--- |
| **Hệ thống** | `GET /api/labs` | Trả về danh sách toàn bộ bài lab quét từ `labs/*/meta.json` |
| **Hệ thống** | `POST /api/system/reset-db` | Khôi phục toàn bộ bảng MiniShop về trạng thái sạch ban đầu |
| **Thực thi Lab** | `POST /api/labs/{lab_id}/{mode}/{action}` | Chạy logic bài lab (`mode`: `vulnerable` hoặc `secure`). Header tùy chọn `X-VVWA-Actor` mang persona đăng nhập (xem mục 4) |
| **Mã nguồn** | `GET /api/labs/{lab_id}/source` | Đọc file thật (`vulnerable.py`, `secure.py`, `LabView.tsx`, cặp sink `frontend/vulnerable.tsx`/`secure.tsx` nếu có) + bản đồ dòng `@step` |
| **Tải Snippet** | `GET /api/labs/{lab_id}/download` | Đóng gói động và tải về file `<lab_id>-fastapi.zip` |
| **Tự kiểm thử** | `POST /api/labs/{lab_id}/verify` | Chạy các test **backend** trong `meta.json` vào `vulnerable.py`; test **frontend** do trình duyệt chạy (xem mục 5) |

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

### Tag dành riêng cho engine
* Tiền tố `engine-` chỉ engine được dùng (ví dụ `engine-session`, xem [ADR-0005](adr/0005-lab-session-actor-context.md)). Lab trả về tag `engine-*` sẽ bị engine biến thành phản hồi lỗi.
* `runtime-error` là bước duy nhất engine trả về khi handler lab ném exception hoặc trả sai cấu trúc.

---

## 3. Single Source of Truth & Chống Lệch Dòng (`# @step` & `# @snippet`)

Thay vì hardcode số dòng (sẽ sai ngay khi sinh viên gõ thêm dòng), ta đặt comment đánh dấu ngay trong file thật. Python dùng `#`, TypeScript/TSX dùng `//`:

```python
# @snippet:start
async def login(payload: dict[str, Any], db: LabDatabaseProtocol) -> dict[str, Any]:
    username = str(payload.get("username", ""))
    password = str(payload.get("password", ""))

    # @step:build-login-query
    sql = (
        "SELECT id, username, email, role, balance FROM users "
        f"WHERE username = '{username}' AND password_hash = '{password}'"
    )

    try:
        # @step:exec-login-query
        row = await db.fetch_one(sql)
    ...
# @snippet:end
```

Mã đầy đủ là SSOT tại [labs/01-sql-injection/backend/vulnerable.py](../labs/01-sql-injection/backend/vulnerable.py) và [secure.py](../labs/01-sql-injection/backend/secure.py). Tài liệu này không chép lại toàn bộ để tránh lệch so với code thật.

### Cách `source_reader.py` hoạt động
1. Đọc trực tiếp file trên đĩa -> phản ánh tức thì mọi thay đổi của sinh viên.
2. Trích xuất phần nằm giữa `@snippet:start` và `@snippet:end` (ẩn boilerplate).
3. Ánh xạ mỗi `@step:<tag>` sang **số dòng thực tế** của dòng code ngay bên dưới, sau đó ẩn dòng comment đánh dấu khi hiển thị trên UI.
4. Trả về `vulnerable`, `secure`, `diff` (tạo bằng `difflib.unified_diff`), `frontend` (`LabView.tsx`), và khi lab có cặp sink frontend thì thêm `frontend_vulnerable`, `frontend_secure`, `frontend_diff`.

---

## 4. Phiên đăng nhập (Session Actor) & `ctx`

Chi tiết và lý do: [ADR-0005](adr/0005-lab-session-actor-context.md).

* Frontend gửi persona đang chọn qua header `X-VVWA-Actor: <username>`. Header này mô phỏng cookie phiên **đáng tin cậy**; body JSON (`payload`) là kênh **do kẻ tấn công kiểm soát**.
* Handler khai báo tham số `ctx` sẽ nhận `LabContext(actor=LabActor(id, username, role) | None)` (import từ `app.schemas`); `role` đọc trực tiếp từ DB ở mỗi request. Handler `(payload, db)` không bị ảnh hưởng.
* Không có header → `ctx.actor is None` (ẩn danh). Username sai định dạng hoặc không tồn tại → HTTP 400.
* Engine chèn bước trace đầu tiên `engine-session` cho biết request đang chạy dưới danh tính nào.

```python
async def view_order(payload: dict[str, Any], db: LabDatabaseProtocol, ctx: LabContext) -> dict[str, Any]:
    order_id = int(payload.get("order_id", 0))   # Do kẻ tấn công kiểm soát
    current = ctx.actor                          # Do engine cấp từ phiên
    ...
```

---

## 5. Test My Fix: Backend + Frontend & Toán tử So khớp

Chi tiết và lý do: [ADR-0006](adr/0006-frontend-sink-grading-and-verify-matchers.md).

* **Test backend** (`layer` mặc định `"backend"`): engine gọi `action` trong `backend/vulnerable.py` với `input` (và `actor` nếu có), rồi so `expect` với `response.data`.
* **Test frontend** (`layer: "frontend"`): trình duyệt render export `component` của `frontend/vulnerable.tsx` với `props` vào một **document trơ** (`document.implementation.createHTMLDocument`). Document này không chạy script và không tải tài nguyên, nên payload không bao giờ thực thi. Sau đó so `expect` với observation của DOM probe:

  | Trường observation | Ý nghĩa |
  | :--- | :--- |
  | `activeContent` | `true` nếu có `script`/`iframe`/`object`/`embed`, thuộc tính `on*`/`srcdoc`, hoặc URL `javascript:` |
  | `findings` | Danh sách dấu hiệu nguy hiểm tìm thấy (để hiển thị cho sinh viên) |
  | `text` | `textContent` của cây đã render |
  | `html` | `innerHTML` của cây đã render |

* **Quy tắc so khớp `expect`** (Python và TypeScript cùng ngữ nghĩa):
  * Dict so subset đệ quy; list phải cùng độ dài; bool so nghiêm ngặt (`true` không bằng `1`).
  * Object mà **mọi key bắt đầu bằng `$`** là object toán tử: `{"$contains": "..."}`, `{"$notContains": "..."}`. Toán tử lạ, toán hạng không phải chuỗi, hoặc object **trộn** key `$` với key thường → test fail kèm lỗi.
  * Mọi nhánh đều được đánh giá hết (không dừng sớm), nên toán tử gõ sai ở bất kỳ đâu trong `expect` luôn báo lỗi, kể cả khi assertion khác trong cùng khối đang fail.
* Lab chỉ **pass** khi mọi test backend và frontend đều pass.

---

## 6. Đặc tả Gói Snippet Tải Về (`.zip`)

Khi bấm **"Tải Snippet"**, FastAPI dùng `zipfile` + `io.BytesIO` tạo file `<lab_id>-fastapi.zip` trực tiếp trong bộ nhớ gồm:

```text
01-sql-injection-fastapi.zip
├── vulnerable.py          # Bản có lỗ hổng (kèm comment giải thích)
├── secure.py              # Bản áp dụng safety pattern
├── diff.patch             # Khác biệt giữa 2 bản (tạo tự động)
├── vulnerable.tsx         # (Chỉ khi lab có cặp sink frontend) Sink có lỗ hổng
├── secure.tsx             # (Chỉ khi lab có cặp sink frontend) Sink an toàn
├── frontend.diff.patch    # (Chỉ khi lab có cặp sink frontend) Diff frontend
└── README.md              # Tóm tắt lỗ hổng, payload mẫu & hướng dẫn tự chạy
```
