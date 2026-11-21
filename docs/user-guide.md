# Hướng dẫn sử dụng

Mô tả bố cục workspace, các điều khiển và quy trình làm một bài lab từ khai thác tới tự vá.

## 1. Bố cục workspace

Workspace chia làm hai bề mặt:

* **MiniShop Sandbox (trái, nền sáng):** giao diện ứng dụng MiniShop để thao tác như người dùng thật.
* **Code & Trace Inspector (phải, nền tối):** mã nguồn đang chạy, dòng code phát sáng theo từng bước và điều khiển phát lại trace.

```text
+---------------------------------------------------------------------------------------+
| VVWA · MiniShop  [Lab 01: SQL Injection v]  API: OK   [Vulnerable|Secure]             |
|                                         [ Reset DB ]  [ Test My Fix ]  [ Tải Snippet ]|
+-------------------------------------------+-------------------------------------------+
|  PIPELINE                                 |  Tabs: [Backend (.py)] [Frontend (.tsx)]  |
|  [1. MiniShop UI] -> [2. FastAPI] -> [3. PostgreSQL]       [Diff]   backend/vulnerable.py
|                                           |  ---------------------------------------  |
|  Lab 01: SQL Injection   Injection  Cơ bản|   1 | async def login(payload, db):       |
|  Đang đăng nhập với tư cách: [alice v]    |   2 |   username = ...                    |
|                                           | > 6 |   sql = f"SELECT ... '{username}'"  |  <- dòng sáng
|  +-------------------------------------+  |     |  +--------------------------------+ |
|  |  Đăng nhập MiniShop                 |  |     |  | Nối chuỗi trực tiếp bằng       | |  <- Inline
|  |  Username: [' OR 1=1--           ]  |  |     |  | f-string                       | |     Callout
|  |  Password: [any                  ]  |  |     |  | SQL thực tế: SELECT ... OR 1=1 | |
|  |  [ Đăng nhập ]                      |  |     |  +--------------------------------+ |
|  +-------------------------------------+  |  11 |   row = await db.fetch_one(sql)     |
|                                           |                                           |
|  Payload mẫu (1-click điền sẵn):          |  [ < Trước ]  [ ▶ Replay ]  [ Sau > ]     |
|  ( Bypass Admin Login ) ( Đăng nhập ... ) |  Safety Pattern: Sử dụng Parameterized... |
|                                           |                                           |
|  Phản hồi từ hệ thống    [BỊ KHAI THÁC]   |                                           |
|  { "logged_in": true, ... }               |                                           |
+-------------------------------------------+-------------------------------------------+
```

## 2. Thanh công cụ & chế độ bố cục

| Điều khiển | Chức năng |
| :--- | :--- |
| **Chọn bài lab** | Danh sách lab được backend tự phát hiện trong `labs/`. Đổi lab sẽ xóa trace và kết quả kiểm thử của lab trước. |
| **Badge API** | `API: OK (v…)` khi backend sẵn sàng; hiện thông báo lỗi khi không kết nối được. |
| **Vulnerable / Secure** | Chọn bản cài đặt sẽ thực thi (`backend/vulnerable.py` hoặc `backend/secure.py`). Dữ liệu đã nhập được giữ nguyên khi gạt. |
| **Bố cục workspace** (`lg+`) | Ba chế độ (lưu qua `localStorage`): **Song song** (chia hai cột, kéo thanh chia `30%`–`70%`; dùng `←`/`→` để chỉnh ±5%, nháy đúp hoặc `Home`/`End` để về `50%`), **Tập trung code** (Inspector toàn chiều rộng kèm nút **Về Song song**), và **Sandbox nổi** (thẻ nổi góc trên phải dưới thanh tab Inspector có nút **Thu gọn** / **Mở rộng** và **Về Song song**, tránh che dòng code và điều khiển trace). Dữ liệu đang nhập trong Sandbox luôn được giữ nguyên khi chuyển chế độ. |
| **Reset DB** | Chạy lại `seed.sql`, đưa toàn bộ dữ liệu MiniShop về trạng thái ban đầu. |
| **Test My Fix** | Chạy bộ `verifyTests` của lab với file `vulnerable.*` hiện tại trên đĩa (xem [mục 5](#5-test-my-fix)). |
| **Tải Snippet** | Tải `<lab_id>-fastapi.zip` gồm bản lỗi, bản vá, diff và README của lab. |

## 3. MiniShop Sandbox

| Khu vực | Chức năng |
| :--- | :--- |
| **Pipeline** | Ba node `MiniShop UI → FastAPI → PostgreSQL`. Node sáng lên khi trace chạy tới tầng đó và giữ màu trạng thái nghiêm trọng nhất đã gặp. Bấm vào node để nhảy tới bước đầu tiên của tầng và dòng code tương ứng. |
| **Thông tin lab** | Tiêu đề, nhóm lỗ hổng, mức độ và tóm tắt kịch bản. |
| **Persona** | Chỉ hiện ở lab có khai báo `actors`. Chọn người dùng đang đăng nhập; giá trị được gửi qua header `X-VVWA-Actor`. |
| **Giao diện lab** | Form MiniShop riêng của từng lab (`frontend/LabView.tsx`). Lab chưa có giao diện riêng dùng **generic runner**: nhập tên action và payload JSON rồi gửi. |
| **Payload mẫu** | Chip điền sẵn dữ liệu vào form; ô nhập nháy nhẹ để báo vị trí vừa được điền. Chip có gắn persona sẽ đổi persona cùng lúc. |
| **Phản hồi từ hệ thống** | JSON `data` trả về từ backend, kèm badge kết quả. |

Badge kết quả:

| Badge | `meta.outcome` | Ý nghĩa |
| :--- | :--- | :--- |
| BỊ KHAI THÁC | `exploited` | Payload đã khai thác thành công |
| ĐÃ CHẶN | `blocked` | Safety pattern đã vô hiệu hóa payload |
| BÌNH THƯỜNG | `normal` | Luồng nghiệp vụ hợp lệ |
| LỖI THỰC THI | `error` | Handler ném lỗi hoặc trả sai cấu trúc |

## 4. Code & Trace Inspector

| Thành phần | Chức năng |
| :--- | :--- |
| **Tab Backend (.py)** | File `backend/<mode>.py` đang chạy, chỉ hiển thị phần giữa `@snippet:start` và `@snippet:end`. |
| **Tab Frontend (.tsx)** | File sink `frontend/<mode>.tsx` nếu lab có cặp sink, nếu không là `frontend/LabView.tsx`. Tab bị vô hiệu khi lab không có mã frontend. |
| **Tab Diff** | Khác biệt giữa bản lỗi và bản vá; lab có cặp sink frontend hiển thị thêm diff `.tsx`. |
| **Làm mới** | Đọc lại mã nguồn từ đĩa. Việc này cũng tự diễn ra khi cửa sổ được focus lại. |
| **Dòng phát sáng** | Dòng ứng với bước trace hiện tại, màu theo trạng thái, kèm **Inline Callout** hiển thị tiêu đề và giá trị thực tế của bước. Khi bước nằm ở file khác, Inspector tự chuyển tab Backend/Frontend và ghi rõ "đã chuyển tab" trên thanh tab; tab Diff không bị tự chuyển. |
| **Trước / Replay / Sau** | Lùi, phát lại từ đầu (600 ms mỗi bước) hoặc tiến từng bước. |
| **Safety Pattern** | Tóm tắt cách phòng chống của lab. |

Màu trạng thái của bước trace:

| Trạng thái | Màu | Ý nghĩa |
| :--- | :--- | :--- |
| `info` | Xanh dương | Bước xử lý bình thường |
| `warning` | Hổ phách | Dữ liệu chưa được kiểm tra, có nguy cơ |
| `danger` | Đỏ | Lỗ hổng vừa được kích hoạt |
| `safe` | Xanh lá | Safety pattern đã chặn payload |

## 5. Test My Fix

Khi bấm **Test My Fix**, workspace chạy song song hai nhóm kiểm thử khai báo trong `meta.json` của lab:

* **Backend:** gọi `POST /api/labs/{id}/verify?reset_db=true`. Engine reset DB trước mỗi test, gọi action trong `backend/vulnerable.py` và so kết quả với `expect`.
* **Frontend:** chạy trong trình duyệt. Component trong `frontend/vulnerable.tsx` được render vào một document trơ (không chạy script, không tải tài nguyên), rồi DOM được quét để tìm nội dung có thể thực thi.

Test My Fix luôn chấm bài làm của bạn trong `vulnerable.*`, kể cả khi workspace đang ở chế độ **Secure**; hộp thoại nhắc điều này khi bạn mở nó từ chế độ Secure.

Hộp thoại kết quả hiển thị `x / y PASS`, từng test kèm badge **Backend** hoặc **Frontend**, giá trị mong đợi, giá trị thực tế và lỗi (nếu có). Lab chỉ đạt khi **mọi** test của cả hai nhóm đều pass. Bấm **Chạy lại kiểm thử** sau mỗi lần sửa file.

## 6. Quy trình làm một bài lab

1. **Khai thác:** chọn chế độ **Vulnerable**, bấm một payload mẫu (hoặc tự nhập) rồi gửi. Theo dõi pipeline và dòng code phát sáng đỏ cùng giá trị thực tế trong callout.
2. **Đối chiếu:** gạt sang **Secure** (dữ liệu nhập được giữ nguyên) và gửi lại. Dòng áp dụng safety pattern phát sáng xanh, payload bị vô hiệu hóa. Mở tab **Diff** để xem đúng những dòng khác nhau.
3. **Tự vá:** mở `labs/<id>/backend/vulnerable.py` (hoặc `frontend/vulnerable.tsx`) trong editor, sửa và lưu. Hot reload áp dụng ngay, không cần khởi động lại.
4. **Kiểm thử:** bấm **Test My Fix** cho tới khi mọi test pass. Sau đó bấm **Reset DB** nếu muốn đưa dữ liệu về trạng thái sạch.
5. **Lưu lại:** bấm **Tải Snippet** để lấy gói `.zip` của lab.

Để khôi phục `vulnerable.py` về bản gốc, dùng Git:

```bash
git checkout -- labs/<id>/backend/vulnerable.py
```

## 7. Nội dung gói snippet

```text
<lab_id>-fastapi.zip
├── vulnerable.py          # Bản có lỗ hổng
├── secure.py              # Bản áp dụng safety pattern
├── diff.patch             # Khác biệt giữa hai bản
├── README.md              # README của lab
├── vulnerable.tsx         # Chỉ khi lab có cặp sink frontend
├── secure.tsx             # Chỉ khi lab có cặp sink frontend
└── frontend.diff.patch    # Chỉ khi lab có cặp sink frontend
```

Gói chứa toàn bộ nội dung file trên đĩa (không cắt theo `@snippet`), tại thời điểm tải.
