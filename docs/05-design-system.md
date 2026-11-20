# 05. Design System — Visual Vulnerable Web App (VVWA)

Tài liệu này quy định hệ thống thiết kế thống nhất giúp giao diện vừa **chuyên nghiệp, hiện đại**, vừa **giảm tải nhận thức (low cognitive load)** cho sinh viên mới học.

---

## 1. Triết lý Thiết kế: "Dual-Surface Pedagogy"

Để sinh viên không bị lẫn lộn giữa **"Ứng dụng đang dùng"** và **"Hệ thống đang giải thích"**, giao diện chia làm 2 bề mặt tương phản rõ ràng:

1. **Bề mặt Sáng (MiniShop Sandbox — Cột trái):** Nền trắng/xám nhẹ (`#F8FAFC`), mang phong cách ứng dụng thương mại điện tử thân thiện. Viền trên cùng đổi màu theo chế độ (`Đỏ` khi Vulnerable, `Xanh lá` khi Secure).
2. **Bề mặt Tối (Code & Trace Inspector — Cột phải):** Nền tối kiểu IDE (`#0F172A`), giúp cú pháp code Python/React và **dòng code phát sáng** nổi bật tuyệt đối, không gây chói mắt.

---

## 2. Stack UI Khuyến nghị

* **Styling:** `Tailwind CSS v4` (nhanh, chuẩn hóa token bằng CSS variables).
* **Component Primitives:** `shadcn/ui` (xây trên Radix UI — sẵn các component chất lượng cao: `Switch`, `Tabs`, `ResizablePanel`, `Tooltip`, `Badge`, `Dialog`, `Select`).
* **Icons:** `lucide-react` (nét mảnh đều `1.75px`, đồng bộ, có sẵn icon bảo mật: `ShieldAlert`, `ShieldCheck`, `Bug`, `Lock`, `Play`, `RotateCcw`, `Download`).
* **Code & Diff Viewer:** `Shiki` (tô màu cú pháp cực đẹp giống VS Code, nhẹ hơn Monaco Editor rất nhiều, dễ tùy biến highlight từng dòng và chèn Inline Callout).

---

## 3. Hệ thống Màu sắc (Color Tokens)

### A. Màu Ngữ nghĩa Bảo mật (Semantic Security Tokens — Quan trọng nhất)
Màu sắc phải **nhất quán 100%** ở mọi nơi: Công tắc Mode, Thanh Pipeline, Dòng code sáng đèn và Badge kết quả.

| Vai trò | Tên Token | Hex | Nền mờ (Highlight / Badge) | Sử dụng cho |
| :--- | :--- | :--- | :--- | :--- |
| **Vulnerable / Danger** | `--color-danger` | `#EF4444` (Red 500) | `rgba(239, 68, 68, 0.16)` | Chế độ Vulnerable, dòng code bị khai thác, bước lỗi trên Pipeline |
| **Secure / Safe** | `--color-safe` | `#10B981` (Emerald 500) | `rgba(16, 185, 129, 0.16)` | Chế độ Secure, Safety Pattern đã chặn, bài test Verify Pass |
| **Warning / Risk** | `--color-warning` | `#F59E0B` (Amber 500) | `rgba(245, 158, 11, 0.16)` | Input chưa sanitize, bước có nguy cơ tiềm ẩn |
| **Active / Info** | `--color-info` | `#3B82F6` (Blue 500) | `rgba(59, 130, 246, 0.16)` | Bước xử lý bình thường đang chạy |
| **MiniShop Brand** | `--color-brand` | `#4F46E5` (Indigo 600) | `rgba(79, 70, 229, 0.10)` | Nút bấm, logo và điểm nhấn riêng bên trong ứng dụng MiniShop |

### B. Màu Bề mặt & Chữ (Surface & Neutral Tokens)

| Vùng | Token | Hex | Mô tả |
| :--- | :--- | :--- | :--- |
| **Sandbox Light** | `--bg-sandbox` | `#F8FAFC` (Slate 50) | Nền khu vực MiniShop bên trái |
| **Sandbox Card** | `--bg-card` | `#FFFFFF` | Card form đăng nhập, thẻ sản phẩm |
| **Sandbox Text** | `--text-primary` | `#0F172A` (Slate 900) | Chữ chính trên nền sáng |
| **Sandbox Muted** | `--text-muted` | `#64748B` (Slate 500) | Ghi chú, mô tả phụ |
| **IDE Dark** | `--bg-ide` | `#0F172A` (Slate 900) | Nền khung xem code bên phải |
| **IDE Header** | `--bg-ide-header` | `#1E293B` (Slate 800) | Thanh tab Backend / Frontend / Diff |
| **IDE Border** | `--border-ide` | `#334155` (Slate 700) | Đường kẻ mảnh phân tách trong khung code |

---

## 4. Typography (Tối ưu hiển thị Tiếng Việt & Code)

* **UI Sans-serif:** `Be Vietnam Pro` (Google Fonts) — thiết kế riêng cho dấu tiếng Việt, cực kỳ rõ ràng ở cỡ chữ nhỏ, không bị dính dấu. Fallback: `Inter, system-ui, sans-serif`.
* **Code Monospace:** `JetBrains Mono` — phân biệt cực rõ ký tự hay gây nhầm lẫn trong payload bảo mật (`'`, `"`, `` ` ``, `1`, `l`, `I`, `0`, `O`).

| Cấp độ | Font | Size / Line-height | Weight | Dùng cho |
| :--- | :--- | :--- | :--- | :--- |
| **Topbar Title** | Be Vietnam Pro | `16px / 24px` | `600` | Tên bài lab hiện tại |
| **Section Heading** | Be Vietnam Pro | `14px / 20px` | `600` | Tiêu đề vùng (Pipeline, Payload mẫu) |
| **Body UI** | Be Vietnam Pro | `14px / 22px` | `400` | Nội dung giải thích, nhãn form |
| **Caption / Badge** | Be Vietnam Pro | `12px / 16px` | `500` | Trạng thái bước, tooltip |
| **Code Block** | JetBrains Mono | `13px / 22px` | `400` | Mã nguồn Python / React / SQL |

---

## 5. Quy chuẩn các Component Đặc thù

### A. Công tắc Chế độ (`ModeSwitch`)
* Dạng Segmented Control gồm 2 nửa rõ ràng:
  * `[ 🐞 Vulnerable ]` — khi active: nền `#FEF2F2`, viền `#EF4444`, chữ `#B91C1C`.
  * `[ 🛡️ Secure ]` — khi active: nền `#ECFDF5`, viền `#10B981`, chữ `#047857`.
* Có hiệu ứng chuyển nền mượt `150ms ease`.

### B. Dòng Code Phát Sáng (`GlowingCodeLine`)
Khi một bước trong `trace` đang active:
* **Viền trái:** Thanh dọc dày `3px` màu theo `status` (`#EF4444` hoặc `#10B981`).
* **Nền dòng:** Tô màu mờ tương ứng + hiệu ứng phát sáng nhẹ (`box-shadow: inset 0 0 12px rgba(...)`).
* **Inline Callout Box:** Mở trượt xuống (`slide-down 200ms`) ngay bên dưới dòng code đang sáng, hiển thị:
  * Icon trạng thái + `title` ngắn gọn.
  * Giá trị biến/SQL thực tế in bằng `JetBrains Mono` (có màu highlight riêng phần payload bị tiêm nếu có).

### C. Thanh Luồng Trực quan (`FlowPipeline`)
* Gồm 3 node ngang nối bằng mũi tên: `1. MiniShop UI` ➔ `2. FastAPI` ➔ `3. PostgreSQL`.
* **Trạng thái Node:**
  * `idle`: Viền xám nhạt, độ mờ `60%`.
  * `active`: Viền màu theo `status`, có vòng sáng pulse nhẹ (`ring-4`) trong lúc đang chạy tới bước đó.
  * `completed`: Giữ màu trạng thái (Đỏ / Xanh lá) để sinh viên nhìn lại toàn bộ hành trình sau khi chạy xong.
* Mọi node đều **click được** để nhảy ngay sang tab & dòng code tương ứng.

### D. Thẻ Payload Mẫu (`PayloadChip`)
* Dạng nút pill nhỏ (`rounded-full`, `border-dashed`), bấm vào sẽ điền thẳng dữ liệu vào form MiniShop kèm hiệu ứng nháy nhẹ ở ô input để sinh viên biết dữ liệu vừa được điền vào đâu.

---

## 6. Khoảng cách & Bo góc (Spacing & Radius)
* **Grid cơ sở:** bội số của `4px` (`4, 8, 12, 16, 24`).
* **Bo góc:**
  * Card / Container: `12px` (`rounded-xl`)
  * Button / Input / Code Callout: `8px` (`rounded-lg`)
  * Badge / Payload Chip: `9999px` (`rounded-full`)
* **Chiều cao Topbar cố định:** `56px` (`h-14`), toàn bộ `LabWorkspace` chiếm trọn `calc(100vh - 56px)` để không bị cuộn trang ngoài — chỉ cuộn độc lập bên trong từng cột Trái/Phải.
