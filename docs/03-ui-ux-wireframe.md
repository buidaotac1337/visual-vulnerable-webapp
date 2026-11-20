# 03. Thiết kế Giao diện & Trải nghiệm Sư phạm (UI/UX)

Giao diện chia làm **2 vùng trực giác tách biệt**:
* **Bên trái (Sáng — MiniShop Sandbox):** Trông giống một trang thương mại điện tử thực tế, giúp sinh viên thao tác tự nhiên.
* **Bên phải (Tối — IDE Code & Trace Inspector):** Giống trình soạn thảo code, giúp dòng code phát sáng (đỏ/xanh) nổi bật rõ rệt.

---

## 1. Bố cục Chính (Split-Screen Workspace)

```text
+---------------------------------------------------------------------------------------+
| [VVWA · MiniShop]     [Lab 01: SQL Injection v]      Mode: [ VULNERABLE | SECURE ]    |
|                                        [ Reset DB ]  [ Test My Fix ]  [ Tải Snippet ] |
+-------------------------------------------+-------------------------------------------+
|  1. THANH LUỒNG TRỰC QUAN (LIVE PIPELINE) |  3. KHUNG GIẢI PHẪU CODE (CODE INSPECTOR) |
|  [MiniShop UI] --> [FastAPI] --> [Postgres]  Tabs: [ Backend (.py) ] [ Frontend ] [Diff]
|     (Xanh)           (ĐỎ!)         (ĐỎ!)  |  ---------------------------------------  |
|                                           |   1 | async def login(payload, db):       |
|  2. ỨNG DỤNG MINISHOP (SANDBOX)           |   2 |   username = payload.get("username")|
|  +-------------------------------------+  |   3 |   password = payload.get("password")|
|  |  Đăng nhập MiniShop                 |  | > 4 |   sql = f"SELECT ... '{username}'..."| <-- Sáng ĐỎ
|  |  Username: [' OR 1=1--           ]  |  |     |  +--------------------------------+ |
|  |  Password: [123                  ]  |  |     |  | [!] SQL thực tế bị tiêm:       | | <-- Inline
|  |                                     |  |     |  | SELECT * FROM users WHERE      | |     Callout
|  |  [ Đăng nhập ]                      |  |     |  | username = '' OR 1=1--' ...    | |
|  +-------------------------------------+  |     |  +--------------------------------+ |
|                                           |   5 |   row = await db.fetch_one(sql)     |
|  Payload mẫu (1-click điền sẵn):          |   6 |   ...                               |
|  [ Bypass Admin ]  [ Đăng nhập thường ]   |                                           |
|                                           |  Điều khiển Trace:                        |
|  Phản hồi từ hệ thống:                    |  [ < Trước ] [ ▶ Replay ] [ Sau > ]       |
|  > Chào mừng admin (Role: ADMIN)!         |                                           |
|                                           |  Safety Pattern:                          |
|                                           |  "Dùng Parameterized Query ($1, $2) để    |
|                                           |   tách biệt câu lệnh SQL và dữ liệu."     |
+-------------------------------------------+-------------------------------------------+
```

---

## 2. Luồng Trải nghiệm Sư phạm Chuẩn (4 Bước Học)

1. **Bước 1 — Khai thác (Chế độ `VULNERABLE`):**
   * Sinh viên bấm nút payload mẫu (hoặc tự gõ) -> bấm Submit.
   * Thanh Pipeline chạy ánh sáng lần lượt qua `MiniShop UI` -> `FastAPI` -> `Postgres`.
   * Khung code bên phải tự cuộn tới dòng lỗi, **phát sáng màu đỏ** và bung hộp **Inline Callout** hiển thị giá trị thật (ví dụ câu SQL đã bị biến dạng).
2. **Bước 2 — Đối chiếu tức thì (Gạt sang `SECURE`):**
   * Công tắc chuyển sang xanh lá, **giữ nguyên input sinh viên vừa nhập**.
   * Bấm Submit lại -> dòng dùng *Safety Pattern* **phát sáng màu xanh lá**, payload bị vô hiệu hóa.
   * Chuyển sang tab **Diff** để nhìn rõ chỉ cần sửa đúng 2 dòng code là giải quyết triệt để lỗ hổng.
3. **Bước 3 — Tự tay vá lỗi (Local Editing + `Test My Fix`):**
   * Sinh viên mở `labs/01-sql-injection/backend/vulnerable.py` trong VS Code và tự sửa.
   * Bấm **Test My Fix** -> hệ thống tự kiểm tra 2 tiêu chí: *(1) Tính năng bình thường vẫn chạy* và *(2) Payload tấn công đã bị chặn*.
4. **Bước 4 — Lưu kiến thức (`Tải Snippet`):**
   * Bấm tải file `.zip` để lưu làm tài liệu ôn tập cá nhân.
