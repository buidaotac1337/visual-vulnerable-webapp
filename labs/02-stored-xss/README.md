# Lab 02: Stored XSS — Đánh giá sản phẩm MiniShop

## 1. Bản chất lỗ hổng

Trang sản phẩm MiniShop hiển thị đánh giá của khách hàng. Component `ReviewContent` trong `frontend/vulnerable.tsx` chèn nội dung đánh giá vào trang **dưới dạng HTML**:

```tsx
<p dangerouslySetInnerHTML={{ __html: content }} />
```

Nội dung đánh giá do người dùng nhập và được lưu vào database. Vì vậy chỉ cần **một** đánh giá độc hại là script chạy trong trình duyệt của **mọi** người mở trang sản phẩm sau đó. Đây là Stored XSS (XSS lưu trữ).

| Payload | Cơ chế |
| :--- | :--- |
| `<img src=x onerror="...">` | Ảnh hỏng kích hoạt `onerror` ngay khi trình duyệt render |
| `<a href="javascript:...">Nhận voucher</a>` | Script chạy khi người xem bấm liên kết |
| `<svg onload="...">` | Thuộc tính sự kiện chạy khi phần tử được dựng |
| `<script>...</script>` | Không chạy khi chèn bằng `innerHTML`, nhưng vẫn là dấu hiệu lỗi và vẫn bị chấm fail |

Trong ứng dụng thật, script của kẻ tấn công chạy với quyền của nạn nhân: đọc dữ liệu trên trang, gửi request thay nạn nhân, hay đánh cắp token không có cờ `HttpOnly`.

## 2. Safety Pattern

**Output encoding tại điểm render.** Hiển thị nội dung người dùng dưới dạng chữ để React tự escape:

```tsx
<p>{content}</p>
```

Khi đó `<img src=x onerror=...>` hiển thị nguyên văn như chữ trên trang và không trở thành thẻ HTML.

Backend của lab này **lưu và trả nguyên văn** nội dung đánh giá ở cả hai mode. Đó là cách làm đúng: escape ở đầu vào làm hỏng dữ liệu (`&` bị lưu thành `&amp;`, React escape thêm lần nữa nên người xem thấy `&amp;`) và đầu vào không biết dữ liệu sẽ được dùng trong ngữ cảnh nào (HTML, thuộc tính, URL, JSON). Bộ kiểm thử có một test xác nhận backend không biến đổi nội dung.

> **Lớp phòng thủ bổ sung (không chấm trong lab):**
> * **Content Security Policy** như `script-src 'self'` chặn inline script và thuộc tính `on*` kể cả khi còn sót sink.
> * Khi thật sự cần cho phép HTML định dạng (in đậm, liên kết), dùng thư viện sanitize có allowlist như DOMPurify thay vì tự lọc bằng regex.
> * Cookie phiên đặt `HttpOnly` để script không đọc được.

## 3. Kịch bản

| Persona | Vai trò |
| :--- | :--- |
| `bob` | Kẻ tấn công, đăng đánh giá chứa payload |
| `alice` | Nạn nhân, mở trang sản phẩm |

Danh tính người viết đánh giá lấy từ phiên đăng nhập (`ctx.actor`), không lấy từ payload.

## 4. Hướng dẫn thực hành

1. Ở chế độ **Vulnerable**, bấm chip **Bob đăng payload onerror** rồi **Gửi đánh giá**. Dòng chữ đỏ thay cho đánh giá cho thấy script của bob đã chạy; dòng `ReviewContent` trong tab Frontend phát sáng đỏ.
2. Bấm chip **Alice xem trang sản phẩm** rồi **Mở trang sản phẩm**: script chạy lại trong phiên của alice.
3. Gạt sang **Secure** (dữ liệu vẫn còn trong DB): payload hiển thị nguyên văn dưới dạng chữ, dòng render phát sáng xanh. Mở tab **Diff** để xem khác biệt ở `vulnerable.tsx` ↔ `secure.tsx`.
4. Mở `labs/02-stored-xss/frontend/vulnerable.tsx`, sửa `ReviewContent` để hiển thị nội dung dưới dạng chữ rồi lưu.
5. Bấm **Test My Fix**: khi đạt **10/10 PASS** (4 backend + 6 frontend) là đã vá xong mà nội dung hợp lệ vẫn hiển thị đúng.
6. Bấm **Reset DB** để xóa các đánh giá đã đăng.
