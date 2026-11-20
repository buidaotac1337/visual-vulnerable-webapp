# Lab 01: SQL Injection — Đăng nhập & Tìm kiếm MiniShop

## 1. Bản chất lỗ hổng

Khi backend ghép trực tiếp dữ liệu người dùng nhập vào chuỗi câu lệnh SQL bằng `f-string`:

```python
sql = f"SELECT id, username, email, role, balance FROM users WHERE username = '{username}' AND password_hash = '{password}'"
```

Kẻ tấn công có thể chèn ký tự nháy đơn `'` và toán tử SQL (`OR 1=1--`, `UNION SELECT ...`) để **thay đổi cấu trúc câu truy vấn**:

1. **Authentication Bypass (`login`):** Nhập `username = "' OR 1=1--"` (hoặc `password = "' OR '1'='1"`) khiến điều kiện `WHERE` luôn đúng → đăng nhập thẳng tài khoản `admin`.
2. **Data Extraction (`search_products`):** Nhập `keyword = "' AND 1=0 UNION SELECT id, username, email || ':' || password_hash, balance, 0 FROM users--"` để đọc toàn bộ thông tin nhạy cảm từ bảng `minishop.users`.
3. **Error-based SQLi:** Nhập một dấu nháy đơn lẻ (`'`) làm vỡ cú pháp SQL và khiến PostgreSQL trả về thông báo lỗi.

## 2. Safety Pattern (Cách phòng chống chuẩn)

Sử dụng **Parameterized Query (`$1, $2` với `asyncpg`)** để PostgreSQL biên dịch cấu trúc SQL trước rồi mới gán dữ liệu vào tham số:

```python
sql = "SELECT id, username, email, role, balance FROM users WHERE username = $1 AND password_hash = $2"
row = await db.fetch_one(sql, username, password)
```

Khi đó chuỗi `' OR 1=1--` hay `O'Reilly` chỉ được đối chiếu như một chuỗi ký tự thuần túy, hoàn toàn không thể thay đổi logic SQL hay gây lỗi cú pháp.

> **Lưu ý nâng cao về `ILIKE`:** Gắn `f"%{keyword}%"` qua tham số `$1` chặn hoàn toàn SQL Injection (không thể thoát khỏi chuỗi), nhưng các ký tự đại diện mẫu của `LIKE`/`ILIKE` như `%` và `_` vẫn có tác dụng khớp ký tự (ví dụ gõ `_` sẽ khớp mọi sản phẩm có tên). Trong ứng dụng thực tế, nếu muốn tìm chính xác ký tự `%`/`_`, cần escape thêm ký tự wildcard trước khi bind.

## 3. Hướng dẫn tự thực hành (4 bước)

1. Chọn chế độ **Vulnerable**, bấm chip **Bypass Admin Login** hoặc **UNION Dump bảng Users** và quan sát dòng code phát sáng đỏ kèm câu SQL thực tế bị tiêm.
2. Gạt công tắc sang **Secure** (input được giữ nguyên), gửi lại để thấy câu lệnh tham số hóa chặn đứng payload.
3. Mở file `labs/01-sql-injection/backend/vulnerable.py` trong VS Code, tự thay `f-string` ở **cả hai** hàm `login` và `search_products` bằng Parameterized Query rồi nhấn `Ctrl+S`.
4. Bấm **Test My Fix** trên thanh công cụ — khi đạt **6/6 PASS** là bạn đã vá lỗi triệt để mà không làm hỏng tính năng hợp lệ.
