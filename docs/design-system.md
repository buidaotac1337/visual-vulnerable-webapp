# Design System

Quy chuẩn giao diện của VVWA: bề mặt, màu ngữ nghĩa, typography, component đặc thù và khoảng cách. Token SSOT nằm tại [`core/frontend/src/styles/tokens.css`](../core/frontend/src/styles/tokens.css).

## 1. Nguyên tắc: hai bề mặt

Giao diện tách hai bề mặt tương phản để không lẫn giữa **ứng dụng đang được dùng** và **hệ thống đang giải thích**:

| Bề mặt | Vị trí | Nền | Phong cách |
| :--- | :--- | :--- | :--- |
| **MiniShop Sandbox** | Cột trái | Sáng `#F8FAFC` | Ứng dụng thương mại điện tử; viền trên đổi màu theo mode (đỏ: Vulnerable, xanh lá: Secure) |
| **Code & Trace Inspector** | Cột phải | Tối `#0F172A` | Kiểu IDE, để cú pháp và dòng phát sáng nổi bật |

## 2. Stack UI

| Mục đích | Thư viện |
| :--- | :--- |
| Styling | Tailwind CSS v4, token bằng CSS variables |
| Control (Tabs, Switch, Dialog, Select) | HTML ngữ nghĩa + ARIA tự viết (`role="tablist"`, `radiogroup`, `<dialog>`), không dùng shadcn/ui hay Radix ([ADR-0004](adr/0004-frontend-workspace-architecture-and-lab-plugin-contract.md)) |
| Icon | `lucide-react` (ví dụ `ShieldAlert`, `ShieldCheck`, `Bug`, `Play`, `RotateCcw`, `Download`) |
| Tô màu cú pháp | Shiki (`shiki/core`), theme `github-dark-default`, ngôn ngữ `python`, `tsx`, `sql`; render thành `<span>` React |

## 3. Màu sắc

### Màu ngữ nghĩa bảo mật

Dùng nhất quán ở mọi nơi: công tắc mode, node pipeline, dòng code phát sáng và badge kết quả.

| Vai trò | Token | Hex | Nền mờ (`*-soft`) | Dùng cho |
| :--- | :--- | :--- | :--- | :--- |
| Vulnerable / Danger | `--color-danger` | `#EF4444` | `rgba(239, 68, 68, 0.16)` | Mode Vulnerable, bước bị khai thác, test fail |
| Secure / Safe | `--color-safe` | `#10B981` | `rgba(16, 185, 129, 0.16)` | Mode Secure, safety pattern đã chặn, test pass |
| Warning | `--color-warning` | `#F59E0B` | `rgba(245, 158, 11, 0.16)` | Input chưa kiểm tra, bước có nguy cơ |
| Info | `--color-info` | `#3B82F6` | `rgba(59, 130, 246, 0.16)` | Bước xử lý bình thường |
| Brand MiniShop | `--color-brand` | `#4F46E5` | `rgba(79, 70, 229, 0.10)` | Nút, logo, điểm nhấn trong MiniShop |

### Bề mặt & chữ

| Vùng | Token | Hex |
| :--- | :--- | :--- |
| Nền sandbox | `--bg-sandbox` | `#F8FAFC` |
| Card sandbox | `--bg-card` | `#FFFFFF` |
| Chữ chính (sáng) | `--text-primary` | `#0F172A` |
| Chữ phụ (sáng) | `--text-muted` | `#64748B` |
| Nền IDE | `--bg-ide` | `#0F172A` |
| Header IDE | `--bg-ide-header` | `#1E293B` |
| Viền IDE | `--border-ide` | `#334155` |

## 4. Typography

| Vai trò | Font | Token |
| :--- | :--- | :--- |
| Giao diện | `Be Vietnam Pro` (fallback `Inter, system-ui, sans-serif`) — hiển thị dấu tiếng Việt rõ ở cỡ nhỏ | `--font-sans` |
| Code & payload | `JetBrains Mono` — phân biệt rõ `'` `"` `` ` `` `1` `l` `I` `0` `O` | `--font-mono` |

Font được nạp từ Google Fonts trong `core/frontend/index.html`.

| Cấp | Font | Size / Line-height | Weight | Dùng cho |
| :--- | :--- | :--- | :--- | :--- |
| Tiêu đề topbar | Be Vietnam Pro | `16px / 24px` | `600` | Tên lab |
| Tiêu đề khu vực | Be Vietnam Pro | `14px / 20px` | `600` | Pipeline, Payload mẫu |
| Nội dung | Be Vietnam Pro | `14px / 22px` | `400` | Giải thích, nhãn form |
| Caption / Badge | Be Vietnam Pro | `12px / 16px` | `500` | Trạng thái bước, tooltip |
| Code | JetBrains Mono | `13px / 22px` | `400` | Python, TSX, SQL |

## 5. Component đặc thù

### `ModeSwitch`

Segmented control hai nửa:

| Nửa | Khi active |
| :--- | :--- |
| Vulnerable | Nền `red-50`, viền `red-500`, chữ `red-700` |
| Secure | Nền `emerald-50`, viền `emerald-500`, chữ `emerald-700` |

### `GlowingCodeLine`

Dòng ứng với bước trace đang active:

* Viền trái `3px` theo `status`.
* Nền mờ theo `status` và glow `box-shadow: inset 0 0 12px rgba(...)`.
* **Inline Callout** trượt xuống (`200ms`) ngay dưới dòng: `Bước N: <title>` và `detail` bằng font mono.

### `FlowPipeline`

Ba node `1. MiniShop UI` → `2. FastAPI` → `3. PostgreSQL`:

| Trạng thái | Hiển thị |
| :--- | :--- |
| `idle` | Viền xám, độ mờ 65% |
| `active` | Viền theo `status` + vòng sáng `ring-4` khi trace đang chạy tới tầng này |
| `completed` | Giữ màu trạng thái nghiêm trọng nhất đã gặp |

Mỗi node bấm được để nhảy tới bước đầu tiên của tầng và dòng code tương ứng. Thứ tự nghiêm trọng: `info` < `safe` < `warning` < `danger`.

### `PayloadChipBar`

Chip dạng pill (`rounded-full`, `border-dashed`). Bấm chip điền dữ liệu vào form và kích hoạt hiệu ứng nháy ô nhập (`450ms`).

## 6. Khoảng cách & bo góc

| Thuộc tính | Giá trị |
| :--- | :--- |
| Lưới cơ sở | Bội số `4px` (`4, 8, 12, 16, 24`) |
| Bo góc card / container | `12px` (`rounded-xl`) |
| Bo góc button / input / callout | `8px` (`rounded-lg`) |
| Bo góc badge / chip | `9999px` (`rounded-full`) |
| Chiều cao topbar | `56px` (`h-14`) |

Từ breakpoint `lg` trở lên, workspace chia hai cột và chiếm `calc(100vh - 56px)`; trang ngoài không cuộn, mỗi cột cuộn độc lập. Dưới `lg`, hai bề mặt xếp chồng thành một cột.
