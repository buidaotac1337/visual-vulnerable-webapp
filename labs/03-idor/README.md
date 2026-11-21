# Lab 03: IDOR — Xem chi tiết đơn hàng MiniShop

## 1. Bản chất lỗ hổng

**IDOR (Insecure Direct Object Reference)** là một dạng Broken Access Control: ứng dụng dùng mã định danh do client gửi lên (`/orders/2`) để lấy đối tượng, nhưng không kiểm tra người đang đăng nhập có quyền với đối tượng đó hay không.

Trang chi tiết đơn hàng của MiniShop truy vấn đơn **chỉ theo `order_id`**:

```python
sql = "SELECT ... FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1"
row = await db.fetch_one(sql, order_id)
```

Câu truy vấn đã tham số hóa nên không có SQL Injection. Lỗi nằm ở **thiếu kiểm tra quyền**: alice chỉ cần đổi số trên URL từ `1` thành `2` là đọc được tên, địa chỉ giao hàng và sản phẩm trong đơn của bob. Mã đơn tăng dần nên kẻ tấn công có thể dò lần lượt toàn bộ đơn hàng.

Hệ thống đã biết người đang đăng nhập (`ctx.actor`, lấy từ phiên). Thứ bị tin nhầm là `order_id` trong request, vốn do người dùng hoàn toàn kiểm soát.

## 2. Safety Pattern

**Ràng buộc mọi truy cập đối tượng theo danh tính từ phiên**, ngay trong truy vấn:

```python
sql = "SELECT ... WHERE o.id = $1 AND o.user_id = $2"
row = await db.fetch_one(sql, order_id, ctx.actor.id)
```

* Danh tính lấy từ `ctx.actor` (engine cấp từ phiên đăng nhập), **không** từ payload. Thêm trường `user_id` vào request rồi kiểm tra trường đó vẫn là lỗi, vì client tự điền được.
* Trả về **cùng một phản hồi** "Không tìm thấy đơn hàng #N" cho đơn không tồn tại và đơn của người khác, để kẻ tấn công không biết đơn nào có thật.
* Kiểm tra ở backend cho **mọi** endpoint nhận mã đối tượng (xem, sửa, hủy, tải hóa đơn), không chỉ ẩn nút trên giao diện.

> **Ngoài phạm vi chấm:** dùng mã định danh khó đoán (UUID) chỉ làm việc dò khó hơn, không thay thế được kiểm tra quyền.

## 3. Kịch bản

| Persona | Đơn hàng |
| :--- | :--- |
| `alice` | Đơn #1 |
| `bob` | Đơn #2 |

Danh sách "Đơn hàng của tôi" đã đúng ở cả hai mode vì nó lọc theo người đăng nhập. Lỗ hổng chỉ nằm ở trang chi tiết.

## 4. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Alice xem đơn của mình** rồi **Mở đơn**: luồng bình thường.
2. Bấm chip **Alice đổi URL sang đơn #2** rồi **Mở đơn**: đơn của bob hiện ra kèm cảnh báo đỏ, dòng `WHERE o.id = $1` phát sáng.
3. Gạt sang **Secure** và mở lại đơn #2: phản hồi là "Không tìm thấy đơn hàng #2.", giống hệt khi mở đơn #999. Tab **Diff** cho thấy chỉ cần thêm điều kiện `o.user_id = $2` và tham số `actor.id`.
4. Mở `labs/03-idor/backend/vulnerable.py`, sửa hàm `view_order` để chỉ trả đơn thuộc về `ctx.actor`, rồi lưu.
5. Bấm **Test My Fix**: khi đạt **7/7 PASS** là đã chặn IDOR mà chủ đơn vẫn xem được đơn của mình.
