# Lab 05: Mass Assignment — Cập nhật hồ sơ khách hàng MiniShop

## 1. Bản chất lỗ hổng

**Mass Assignment** (còn gọi là *autobinding* hay *over-posting*) xảy ra khi server gán thẳng dữ liệu từ request vào model: mọi trường có tên trùng với một cột đều được ghi, kể cả những cột người dùng không bao giờ được sửa.

Form "Hồ sơ của tôi" chỉ có ô **email**, nhưng `update_profile` lấy mọi key trong request khớp với một cột của bảng `users`:

```python
_USER_COLUMNS = {"email": "varchar", "role": "varchar", "balance": "numeric"}

changes = {key: value for key, value in payload.items() if key in _USER_COLUMNS}
sql, args = _update_sql(changes)  # UPDATE users SET email = ..., role = ..., balance = ...
```

Tên các cột này không phải bí mật: chính phản hồi API của trang hồ sơ đã trả về `role` và `balance`. Kẻ tấn công chỉ cần thêm một trường vào JSON (bằng DevTools hoặc proxy):

```json
{ "email": "bob@minishop.local", "role": "admin" }
```

Sau request đó, bob là `admin` trong database. Engine đọc `role` trực tiếp từ database ở mỗi request, nên bước **Phiên đăng nhập** của request kế tiếp đã hiện `role=admin`. Tương tự, gửi `"balance": 999999` là tự nạp tiền.

Truy vấn vẫn tham số hóa và vẫn chỉ sửa hàng của chính người đăng nhập (`WHERE id = ctx.actor.id`). Lỗi nằm ở chỗ **request được quyết định cột nào bị ghi**.

## 2. Safety Pattern

**Mỗi thao tác có một schema riêng, liệt kê đúng các trường người dùng được sửa, và từ chối mọi trường khác.**

```python
class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(max_length=120, pattern=_EMAIL_PATTERN)


changes = ProfileUpdate.model_validate(payload).model_dump()
await db.execute("UPDATE users SET email = $1 WHERE id = $2", changes["email"], actor.id)
```

* `extra="forbid"` từ chối cả request khi có trường ngoài schema, nên việc dò quyền hiện rõ trong log. `extra="ignore"` (mặc định của Pydantic) chỉ âm thầm bỏ qua trường thừa; cách này cũng đạt yêu cầu chấm.
* Schema cũng là nơi validate định dạng của các trường được phép sửa (email).
* `role`, `balance` chỉ được đổi bởi code phía server có kiểm tra quyền riêng (trang quản trị, luồng thanh toán), không bao giờ từ form hồ sơ.
* Không dùng chung một schema cho đọc và ghi: schema trả về (có `role`, `balance`) khác schema nhận vào.

> **Ngoài phạm vi chấm:** ghi log và cảnh báo khi một request chứa trường bị cấm.

## 3. Kịch bản

| Persona | Email | Vai trò | Số dư |
| :--- | :--- | :--- | ---: |
| `alice` | `alice@minishop.local` | `customer` | $500.00 |
| `bob` | `bob@minishop.local` | `customer` | $250.00 |

Khung **Trường thêm vào request (ngoài form)** đóng vai DevTools: thêm, sửa hoặc bỏ các key nằm ngoài form trước khi gửi.

## 4. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Alice đổi email** rồi **Lưu hồ sơ**: luồng bình thường.
2. Bấm chip **Bob thêm role: admin** rồi **Lưu**: thẻ hồ sơ hiện vai trò `admin` màu đỏ, dòng gán trường phát sáng. Lưu thêm một lần nữa và xem bước **Phiên đăng nhập** đã báo `role=admin`.
3. Bấm chip **Alice tự nạp tiền** rồi **Lưu**: số dư thành $999999.00.
4. Gạt sang **Secure** và thử lại: request bị từ chối với "Không được phép cập nhật trường: role." Tab **Diff** cho thấy schema `ProfileUpdate` thay cho vòng lặp gán trường.
5. Mở `labs/05-mass-assignment/backend/vulnerable.py`, sửa `update_profile` để chỉ nhận email đã được validate, rồi lưu.
6. Bấm **Test My Fix**: khi đạt **6/6 PASS** là đã chặn tự nâng quyền và tự nạp tiền, trong khi đổi email vẫn hoạt động.

> Mỗi lần lưu thành công đều ghi vào database. Bấm **Reset DB** để đưa hồ sơ về ban đầu.
