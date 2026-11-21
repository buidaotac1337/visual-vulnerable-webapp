# Lab 04: Business Logic — Giỏ hàng & Thanh toán MiniShop

## 1. Bản chất lỗ hổng

**Lỗi logic nghiệp vụ (Business Logic Flaw)** xảy ra khi từng dòng code đều "đúng" về kỹ thuật (truy vấn tham số hóa, có kiểm tra phiên) nhưng quy tắc nghiệp vụ lại dựa vào dữ liệu mà người dùng tự quyết định được.

Trang thanh toán của MiniShop gửi cả **đơn giá** và **số lượng** của từng món lên server, và server tính tiền bằng chính các con số đó:

```python
class CartItem(BaseModel):
    product_id: int
    quantity: int  # không giới hạn: 0 và số âm đều hợp lệ
    price: float  # giá do trình duyệt gửi lên


lines = [(item, _money(item.price)) for item in cart.items]
total = sum(price * item.quantity for item, price in lines)
```

Hai cách khai thác:

* **Sửa giá:** đơn giá nằm trong request (như một input ẩn), nên chỉ cần DevTools hoặc proxy là đổi được `price` từ `120` thành `1`.
* **Số lượng âm:** `quantity = -5` cho tổng tiền âm. Câu `UPDATE users SET balance = balance - $1` trừ một số âm, tức là **cộng tiền** vào số dư. Trộn một món số lượng âm với món thật còn cho phép "bù trừ" để nhận hàng mà tổng tiền gần bằng 0.

Kiểm tra tồn kho (`quantity > stock`) và kiểm tra số dư vẫn có, nhưng không chặn được, vì chúng chỉ kiểm tra cận trên và kiểm tra trên một con số đã bị sửa.

## 2. Safety Pattern

**Client chỉ được chọn mua gì và bao nhiêu. Mọi con số nghiệp vụ khác do server quyết định.**

```python
class CartItem(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)  # Pydantic từ chối 0 và số âm


lines = [(item, _money(catalog[item.product_id]["price"])) for item in cart.items]
```

* Bỏ `price` khỏi schema của request. Pydantic mặc định bỏ qua trường thừa, nên giá client gửi lên không còn đi vào logic.
* Đọc lại đơn giá từ database (`catalog`) ngay trước khi tính tổng và trừ tiền.
* Validate ràng buộc nghiệp vụ ở backend (`gt=0`). Thuộc tính `min="1"` trên input chỉ là trải nghiệm người dùng, không phải kiểm soát an ninh.

> **Ngoài phạm vi chấm:** trừ tiền, tạo đơn và trừ tồn kho trong cùng một transaction; giới hạn số lượng tối đa mỗi đơn. Tranh chấp khi nhiều request cùng lúc thuộc Lab 07 (Race Condition).

## 3. Kịch bản

| Persona | Số dư ban đầu |
| :--- | :--- |
| `alice` | $500.00 |
| `bob` | $250.00 |

| Sản phẩm | Giá niêm yết | Tồn kho |
| :--- | ---: | ---: |
| #1 Bàn phím cơ MiniShop K1 | $89.00 | 25 |
| #2 Chuột không dây Silent M2 | $45.00 | 40 |
| #3 Tai nghe chống ồn Studio S3 | $120.00 | 15 |

Cột **Đơn giá gửi lên** trong giỏ hàng là trường trình duyệt gửi kèm đơn. Khi giá này khác giá niêm yết, giao diện hiện giá niêm yết màu đỏ bên dưới.

## 4. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Alice mua hàng bình thường** rồi **Thanh toán**: số dư giảm $89.
2. Bấm chip **Sửa giá tai nghe thành $1** rồi **Thanh toán**: đơn được tạo với tổng $1.00, dòng tính tổng tiền phát sáng đỏ.
3. Bấm chip **Số lượng âm để được cộng tiền** rồi **Thanh toán**: số dư của alice **tăng** $225.
4. Gạt sang **Secure** và thử lại: giá $1 bị bỏ qua (tính $120), số lượng âm bị Pydantic từ chối. Tab **Diff** cho thấy chỉ cần đổi `CartItem` và nguồn của đơn giá.
5. Mở `labs/04-business-logic/backend/vulnerable.py`, sửa `CartItem` và dòng tính `lines` trong `checkout`, rồi lưu.
6. Bấm **Test My Fix**: khi đạt **7/7 PASS** là đã chặn được cả sửa giá lẫn số lượng âm, trong khi đơn hợp lệ vẫn tính đúng tiền.

> Mỗi lần thanh toán thành công đều ghi vào database. Bấm **Reset DB** để đưa số dư về ban đầu.
