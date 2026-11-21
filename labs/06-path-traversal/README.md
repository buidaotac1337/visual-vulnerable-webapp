# Lab 06: Path Traversal — Tải hóa đơn MiniShop

## 1. Bản chất lỗ hổng

**Path Traversal** (Directory Traversal) xảy ra khi ứng dụng ghép dữ liệu của client vào một đường dẫn file mà không kiểm tra đường dẫn cuối cùng nằm ở đâu. Các đoạn `../` đưa đường dẫn ra khỏi thư mục dự kiến, và server đọc bất kỳ file nào nó có quyền đọc.

Trang tải hóa đơn của MiniShop nhận tên file trên URL và ghép thẳng vào thư mục hóa đơn:

```python
name = str(payload.get("file", ""))
path = f"{invoice_dir}/{name}"
content = _read_capped(Path(path))
```

| Tên file gửi lên | Đường dẫn thật | Kết quả |
| :--- | :--- | :--- |
| `INV-0001.txt` | `.../invoices/INV-0001.txt` | Hóa đơn của alice (hợp lệ) |
| `../config/secrets.env` | `.../config/secrets.env` | Lộ token quản trị |
| `../../../../../../etc/passwd` | `/etc/passwd` | Lộ file hệ thống của server |
| `export.csv` | `.../invoices/export.csv` | Lộ email và số dư mọi khách hàng |
| `INV-0002.txt` | `.../invoices/INV-0002.txt` | Hóa đơn của bob (IDOR) |

Backend trong Docker chạy bằng `root`, nên mọi file trong container đều đọc được, kể cả `/proc/self/environ` (biến môi trường, gồm chuỗi kết nối database).

## 2. Safety Pattern

**Không dùng tên file của client làm đường dẫn.** Kiểm tra theo ba lớp, lớp nào cũng trả cùng một thông báo "Không có hóa đơn":

```python
match = re.fullmatch(r"INV-([0-9]{4})\.txt", name)  # 1. Chỉ nhận tên đúng mẫu (chữ số ASCII)
real = (invoice_dir / name).resolve()  # 2. Đường dẫn thật phải nằm trong thư mục
if not real.is_relative_to(invoice_dir.resolve()):
    ...
await db.fetch_val(_OWNER_SQL, int(match[1]), actor.id)  # 3. Hóa đơn thuộc ctx.actor
```

* **Allowlist tên file** chặn `../`, `/`, `\`, đường dẫn tuyệt đối và mọi phần mở rộng khác, kể cả file nội bộ nằm ngay trong thư mục (`export.csv`).
* **`resolve()` + `is_relative_to()`** là lớp phòng thủ thứ hai: chuẩn hóa `..` và symlink rồi so với thư mục gốc. Không so sánh chuỗi bằng `startswith`, vì `/invoices-old` cũng "bắt đầu bằng" `/invoices`.
* **Kiểm tra chủ sở hữu** như Lab 03: tên hóa đơn đoán được, nên phải ràng buộc theo `ctx.actor`.
* **Xóa `../` bằng `replace` là chưa đủ:** `....//` sau khi xóa sẽ thành `../`. Test My Fix có bài kiểm tra cách lách này.

> **Ngoài phạm vi chấm:** lưu file theo ID ngẫu nhiên thay vì tên đoán được; chạy service với user không phải root và chỉ cấp quyền đọc thư mục hóa đơn. Phần **Upload ảnh sản phẩm** được tách thành lab riêng vì cần quyết định sandbox ghi file (xem [Lộ trình](../../docs/roadmap.md)).

## 3. Kịch bản

| Persona | Hóa đơn |
| :--- | :--- |
| `alice` | `INV-0001.txt` (đơn #1) |
| `bob` | `INV-0002.txt` (đơn #2) |

Mỗi request, lab tự sinh lại thư mục sandbox trong thư mục tạm của server (`/tmp/vvwa-minishop` trong Docker, không mount ra máy host):

```text
vvwa-minishop/
├── invoices/   # INV-0001.txt, INV-0002.txt ... (theo bảng orders) và export.csv
└── config/     # secrets.env (token giả để minh họa)
```

Lab chỉ **đọc** file, mỗi lần tối đa 4 KB, nên các file đặc biệt như `/dev/zero` không làm treo backend.

> **Lưu ý an toàn:** backend mở cổng trên `0.0.0.0:8000`. Ở chế độ Vulnerable, bất kỳ ai gọi được API đều đọc được file trong container backend. Chỉ chạy VVWA trên máy cá nhân hoặc mạng tin cậy.

## 4. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm `INV-0001.txt` trong danh sách: luồng bình thường.
2. Bấm chip **Đọc file cấu hình bí mật** rồi **Tải**: nội dung `secrets.env` hiện ra kèm cảnh báo đỏ; bước **build-path** cho thấy đường dẫn thật đã ra khỏi `invoices/`.
3. Thử chip **Đọc /etc/passwd của server**, **File xuất dữ liệu khách hàng** và **Tải hóa đơn của bob**.
4. Gạt sang **Secure** và thử lại: mọi trường hợp đều trả "Không có hóa đơn ...". Tab **Diff** cho thấy ba lớp kiểm tra được thêm vào.
5. Mở `labs/06-path-traversal/backend/vulnerable.py`, sửa `download_invoice`, rồi lưu. Thử chip **Lách bộ lọc ....//** nếu bản vá của bạn dùng `replace`.
6. Bấm **Test My Fix**: khi đạt **7/7 PASS** là đã chặn traversal, file nội bộ và hóa đơn của người khác, trong khi chủ hóa đơn vẫn tải được.
