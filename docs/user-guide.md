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
|  Payload mẫu (1-click điền sẵn):          |  [< Trước] [▶ Phát] [Sau >]  [Tay|1×|2×] |
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
| **Lộ trình (`X/9`)** | Mở hộp thoại danh mục các bài lab theo mức độ (`Cơ bản` → `Trung bình`), có tìm kiếm và thanh tiến độ số bài đã vượt qua **Test My Fix**. |
| **Từ điển** | Mở từ điển bảo mật web tiếng Việt (giao diện VVWA, lỗ hổng, cách phòng vệ) kèm ví dụ đời thường cho người mới. |
| **Badge API** | `API: OK (v…)` khi backend sẵn sàng; hiện thông báo lỗi khi không kết nối được. |
| **Vulnerable / Secure / Song song** | Chọn bản cài đặt sẽ thực thi (`backend/vulnerable.py` hoặc `backend/secure.py`). Dữ liệu đã nhập được giữ nguyên khi gạt. Chấm màu trên nút Vulnerable và Secure là kết quả lần chạy gần nhất của mode đó (đỏ: bị khai thác, xanh: đã chặn, xám: bình thường, vàng: lỗi). **Song song** chạy cùng payload trên cả hai bản: xem [mục 4.1](#41-chế-độ-song-song). |
| **Bố cục workspace** (`lg+`) | Ba chế độ (lưu qua `localStorage`): **Chia đôi** (chia hai cột, kéo thanh chia `30%`–`70%`; dùng `←`/`→` để chỉnh ±5%, nháy đúp hoặc `Home`/`End` để về `50%`), **Tập trung code** (Inspector toàn chiều rộng kèm nút **Về Chia đôi**), và **Sandbox nổi** (thẻ nổi góc trên phải dưới thanh tab Inspector có nút **Thu gọn** / **Mở rộng** và **Về Chia đôi**, tránh che dòng code và điều khiển trace). Dữ liệu đang nhập trong Sandbox luôn được giữ nguyên khi chuyển chế độ. |
| **Giao diện Sáng / Tối / Theo hệ thống** | Nút icon (mặt trời / mặt trăng / màn hình) xoay vòng giữa ba lựa chọn, lưu trong `localStorage` (`vvwa.colorMode`). Mặc định theo cài đặt của hệ điều hành. Code & Trace Inspector luôn dùng nền tối kiểu IDE ở mọi lựa chọn. |
| **Reset DB** | Chạy lại `seed.sql`, đưa toàn bộ dữ liệu MiniShop về trạng thái ban đầu. |
| **Test My Fix** | Chạy bộ `verifyTests` của lab với file `vulnerable.*` hiện tại trên đĩa (xem [mục 5](#5-test-my-fix)). |
| **Tải Snippet** | Tải `<lab_id>-fastapi.zip` gồm bản lỗi, bản vá, diff và README của lab. |

## 3. MiniShop Sandbox

| Khu vực | Chức năng |
| :--- | :--- |
| **Banner làm quen** | Chỉ hiện ở lần truy cập đầu (không chặn thao tác, ẩn vĩnh viễn khi bấm *Đã hiểu*), giới thiệu nhanh mô hình hai cột cùng lối tắt tới **Lộ trình** và **Từ điển**. |
| **Pipeline** | Ba node `MiniShop UI → FastAPI → PostgreSQL`. Node sáng lên khi trace chạy tới tầng đó và giữ màu trạng thái nghiêm trọng nhất đã gặp. Bấm vào node để nhảy tới bước đầu tiên của tầng và dòng code tương ứng. |
| **Thông tin lab & Hiểu nhanh 30 giây** | Tiêu đề, nhóm lỗ hổng, mức độ, tóm tắt kịch bản và thẻ mở rộng giải thích bằng ví dụ đời thường, hậu quả thực tế, gợi ý thử nhanh, đường dẫn file cần sửa (sao chép 1-click) và chip mở thẳng **Từ điển**. |
| **Checklist 4 bước học** | Tự động đánh dấu tiến độ 4 chặng (*Thử tấn công* → *So sánh bản vá* → *Xem Diff* → *Tự vá & chấm bài*) và cung cấp nút tắt chuyển chế độ/tab tương ứng (lưu trong `localStorage`). |
| **Persona** | Chỉ hiện ở lab có khai báo `actors`. Chọn người dùng đang đăng nhập; giá trị được gửi qua header `X-VVWA-Actor`. |
| **Giao diện lab** | Form MiniShop riêng của từng lab (`frontend/LabView.tsx`). Lab chưa có giao diện riêng dùng **generic runner**: nhập tên action và payload JSON rồi gửi. |
| **Payload mẫu** | Chip điền sẵn dữ liệu vào form, phân biệt trực quan giữa **Thử tấn công** và **Luồng hợp lệ**; ô nhập nháy nhẹ và nhắc người dùng bấm nút gửi. Chip có gắn persona sẽ đổi persona cùng lúc. |
| **Phản hồi từ hệ thống** | Tóm tắt tiếng Việt *"Chuyện gì vừa xảy ra?"* kèm nút hành động gợi ý bước tiếp theo (ví dụ chuyển sang **Secure**, mở **Diff** hoặc chạy **Test My Fix**) và khối JSON `data` có thể thu gọn/mở rộng. |

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
| **Tab Backend (.py)** | File `backend/<mode>.py` đang chạy, chỉ hiển thị phần giữa `@snippet:start` và `@snippet:end`, kèm nút sao chép nhanh đường dẫn tương đối (`labs/<id>/...`). |
| **Tab Frontend (.tsx)** | File sink `frontend/<mode>.tsx` nếu lab có cặp sink, nếu không là `frontend/LabView.tsx`. Tab bị vô hiệu khi lab không có mã frontend. |
| **Tab Diff** | Khác biệt giữa bản lỗi và bản vá kèm dải hướng dẫn đọc ký hiệu `-` (dòng lỗi cần bỏ/sửa) / `+` (dòng an toàn thay thế) và nút sao chép đường dẫn file cần sửa; lab có cặp sink frontend hiển thị thêm diff `.tsx`. |
| **Chú giải màu trace** | Dải gọn ngay dưới thanh tab giải thích 4 màu trạng thái (`Thông tin`, `Cảnh báo`, `Lỗ hổng`, `Đã chặn`) và mẹo khởi đầu khi chưa có trace. |
| **Làm mới** | Đọc lại mã nguồn từ đĩa. Việc này cũng tự diễn ra khi cửa sổ được focus lại. |
| **Dòng phát sáng** | Dòng ứng với bước trace hiện tại, màu theo trạng thái, kèm **Inline Callout** hiển thị badge tầng (`MiniShop UI` / `FastAPI Backend` / `PostgreSQL DB`), badge trạng thái, tiêu đề và giá trị thực tế của bước. Khi bước nằm ở file khác, Inspector tự chuyển tab Backend/Frontend và ghi rõ "đã chuyển tab" trên thanh tab; tab Diff không bị tự chuyển. |
| **Điều khiển phát & tiến độ** | Thanh tiến độ ở mép trên `TraceControls`, nút **Trước**, nút chuyển trạng thái **Phát / Dừng / Phát lại**, nút **Sau** và bộ đếm `Bước X / Y`. |
| **Tốc độ phát (`Tốc độ`)** | Bốn mức lưu qua `localStorage` (`vvwa.traceSpeed`): **Tay** (thủ công, dừng ngay ở bước 1 không tự chạy), **0.5×** (`1.2 giây/bước`), **1×** (`0.6 giây/bước`, mặc định) và **2×** (`0.3 giây/bước`). |
| **Thanh pill bước trace** | Hàng nút số bước kèm chấm màu trạng thái; rê chuột hoặc focus để xem tiêu đề bước và bấm để nhảy thẳng tới bước đó. |
| **Phím tắt** | `←` / `→` để lùi/tiến bước, `Space` để phát/dừng/phát lại (tự bỏ qua khi đang nhập trong form, mở modal kiểm thử hoặc thao tác trên tab/công tắc/nút). |
| **Safety Pattern** | Tóm tắt cách phòng chống của lab. |

Màu trạng thái của bước trace:

| Trạng thái | Màu | Ý nghĩa |
| :--- | :--- | :--- |
| `info` | Xanh dương | Bước xử lý bình thường |
| `warning` | Hổ phách | Dữ liệu chưa được kiểm tra, có nguy cơ |
| `danger` | Đỏ | Lỗ hổng vừa được kích hoạt |
| `safe` | Xanh lá | Safety pattern đã chặn payload |

### 4.1. Chế độ Song song

Bấm **Song song** trên thanh công cụ để so sánh hai bản cài đặt trong một lần gửi ([ADR-0010](adr/0010-song-song-compare-mode.md)):

1. Mỗi lần bấm gửi trong MiniShop, VVWA chạy **Reset DB → Secure → Reset DB → Vulnerable**. Hai phía cùng bắt đầu từ dữ liệu seed. Burst nhiều request của Lab 08 vẫn chạy đủ N request trên mỗi phía.
2. MiniShop hiện kết quả phía Vulnerable, và database sau lượt chạy mang trạng thái của phía này. Dữ liệu bạn tạo trước lượt chạy (review, đơn hàng, file upload) sẽ bị xóa.
3. Tab **Backend** hiện badge kết quả của hai phía, bảng trace căn theo từng bước (bước chỉ một bản có thì ô bên kia để trống) và hai file `vulnerable.py` / `secure.py` cạnh nhau. Mỗi file tự sáng dòng code của bước đang phát. Bấm một hàng để nhảy tới bước đó. Các nút Trước / Phát / Sau và phím tắt điều khiển cả hai phía cùng lúc.
4. Với lab có sink frontend (Lab 02), phía Secure không có bước render frontend vì MiniShop render bằng sink của phía Vulnerable. Khác biệt của sink xem ở tab **Diff**.

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
