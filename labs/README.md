# Labs

Mỗi thư mục con là một bài lab độc lập, được backend tự phát hiện qua `meta.json`.

| ID | Lab | Nhóm | Mức độ |
| :--- | :--- | :--- | :--- |
| [`01-sql-injection`](01-sql-injection/README.md) | SQL Injection — Đăng nhập & Tìm kiếm MiniShop | Injection | Cơ bản |
| [`02-stored-xss`](02-stored-xss/README.md) | Stored XSS — Đánh giá sản phẩm MiniShop | XSS | Cơ bản |
| [`03-idor`](03-idor/README.md) | IDOR — Xem chi tiết đơn hàng MiniShop | Access Control | Cơ bản |
| [`04-business-logic`](04-business-logic/README.md) | Business Logic — Giỏ hàng & Thanh toán MiniShop | Business Logic | Cơ bản |

## Cấu trúc một lab

```text
labs/<id>-<slug>/
├── meta.json          # Metadata, payload mẫu, verifyTests
├── README.md          # Lý thuyết lỗ hổng và safety pattern
├── backend/
│   ├── vulnerable.py  # Bản có lỗ hổng (file cần vá)
│   └── secure.py      # Bản áp dụng safety pattern
└── frontend/
    ├── LabView.tsx    # Giao diện MiniShop của lab (không chứa sink)
    ├── vulnerable.tsx # Tùy chọn, đi theo cặp: sink frontend có lỗ hổng
    └── secure.tsx     # Tùy chọn, đi theo cặp: sink frontend an toàn
```

Đặc tả đầy đủ: [Tạo bài lab](../docs/lab-authoring.md).

> [!IMPORTANT]
> Mã lỗ hổng có chủ đích chỉ được đặt trong `backend/vulnerable.py` và `frontend/vulnerable.tsx`. `LabView.tsx`, `secure.*` và toàn bộ `core/` không chứa sink.

Muốn khôi phục file đã sửa về bản gốc:

```bash
git checkout -- labs/<id>/backend/vulnerable.py
```
