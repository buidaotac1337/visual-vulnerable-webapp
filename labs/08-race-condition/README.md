# Lab 08: Race Condition (TOCTOU) — Áp mã giảm giá MiniShop

## 1. Bản chất lỗ hổng

**Race Condition dạng TOCTOU (Time-of-Check to Time-of-Use)** xảy ra khi ứng dụng kiểm tra điều kiện nghiệp vụ tại một thời điểm, rồi thực hiện thay đổi dữ liệu ở một thời điểm sau đó mà **không khóa dữ liệu** giữa hai bước.

Chức năng áp mã giảm giá của MiniShop quy đổi ưu đãi trên đơn hàng `$100.00` thành tiền thưởng cộng vào số dư tài khoản (`WELCOME10` = `+$10.00`, tối đa `1` lượt; `STUDENT20` = `+$20.00`, tối đa `5` lượt). Bản lỗi thực hiện tuần tự 3 thao tác trên các kết nối rời rạc của connection pool:

```python
coupon = await db.fetch_one("SELECT ... FROM coupons WHERE code = $1", code)  # Time-of-Check
if coupon["used_count"] >= coupon["max_uses"]:
    ...
await asyncio.sleep(0.06)  # Cửa sổ TOCTOU
await db.fetch_val(
    "UPDATE coupons SET used_count = used_count + 1 ...", coupon["id"]
)  # Time-of-Use
```

Khi 5 request cùng đến trước khi bất kỳ request nào chạy tới `UPDATE`:

1. Cả 5 request đều đọc được `used_count = 0 < 1`.
2. Cả 5 request đều vượt qua câu lệnh `if used_count >= max_uses`.
3. Cả 5 request lần lượt tăng `used_count` thành `1, 2, 3, 4, 5` và cộng `+$50.00` vào ví của `alice` thay vì chỉ `+$10.00`.

## 2. Safety Pattern

Gom toàn bộ chu trình **đọc – kiểm tra – cập nhật** vào một transaction duy nhất trên cùng một kết nối database (`db.transaction()`, xem [ADR-0008](../../docs/adr/0008-db-transactions-and-concurrent-verify-tests.md)) và đặt khóa hàng bi quan **`SELECT ... FOR UPDATE`**:

```python
async with db.transaction() as tx:
    coupon = await tx.fetch_one(
        "SELECT id, code, discount_percent, max_uses, used_count "
        "FROM coupons WHERE code = $1 FOR UPDATE",
        code,
    )
    if int(coupon["used_count"]) >= int(coupon["max_uses"]):
        return ...
    new_used_count = int(await tx.fetch_val(...))
    new_balance = float(await tx.fetch_val(...))
```

* **`db.transaction()`:** Mượn duy nhất một connection từ `asyncpg.Pool` và bọc trong `BEGIN ... COMMIT`, giữ khóa PostgreSQL tồn tại xuyên suốt từ `SELECT` đến hết các lệnh `UPDATE`.
* **`SELECT ... FOR UPDATE`:** Request đầu tiên chiếm khóa hàng trên dòng mã giảm giá; các request đồng thời khác bị PostgreSQL giữ chờ tại câu `SELECT ... FOR UPDATE`. Khi request đầu commit `used_count = 1`, các request đến sau tự động đọc lại giá trị mới nhất (`1 >= 1`) và bị chặn gọn gàng (`outcome = "blocked"`).

## 3. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Bắn đồng thời 5 request WELCOME10** rồi bấm **Bắn đồng thời 5 request**. Quan sát `WELCOME10` vượt giới hạn thành `5/1` (`over_limit = true`) và số dư của `alice` tăng lên `$550.00` kèm banner cảnh báo đỏ.
2. Nhấn **Reset DB**, thử chip **Bắn đồng thời 8 request STUDENT20 (giới hạn 5)**: toàn bộ `8` request đều thành công (`8/5`), số dư tăng lên `$660.00` thay vì `$600.00`.
3. Gạt sang chế độ **Secure**, nhấn **Reset DB** và thử lại cả hai burst: chỉ đúng `1` request `WELCOME10` (và `5` request `STUDENT20`) thành công; các request dư bị chặn bởi khóa hàng.
4. Mở `labs/08-race-condition/backend/vulnerable.py`, vá hàm `apply_coupon` theo hướng dẫn trong tab **Diff**, lưu file và bấm **Test My Fix** để kiểm tra đạt **5/5 PASS** (bao gồm 2 ca kiểm thử đồng thời).
