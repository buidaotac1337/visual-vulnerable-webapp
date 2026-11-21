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

| Vai trò | Class Tailwind | Bảng màu gốc | Dùng cho |
| :--- | :--- | :--- | :--- |
| Vulnerable / Danger | `*-danger-50` … `*-danger-950`, `*-danger`, `*-danger-soft` | `red` | Mode Vulnerable, bước bị khai thác, test fail |
| Secure / Safe | `*-safe-*` | `emerald` | Mode Secure, safety pattern đã chặn, test pass |
| Warning | `*-warning-*` | `amber` | Input chưa kiểm tra, bước có nguy cơ |
| Info | `*-info-*` | `blue` | Bước xử lý bình thường |
| Brand MiniShop | `*-brand-*` | `indigo` | Nút, logo, điểm nhấn trong MiniShop |

Mỗi vai trò là một dải màu đầy đủ (`50` … `950`) khai báo trong khối `@theme inline` của `tokens.css`, nên dùng được như mọi màu Tailwind: `bg-danger-50`, `text-safe-700`, `border-warning-300/60`. `*-soft` là nền mờ (16%, brand 10%). Đổi bảng màu gốc của một vai trò trong `tokens.css` là đổi màu toàn bộ giao diện.

ESLint chặn các class màu gốc `red-*`, `emerald-*`, `amber-*`, `blue-*`, `indigo-*` ở mọi file `.ts`/`.tsx`, kể cả lab và `vulnerable.tsx`. Màu trung tính (`slate-*`) và màu nhãn phụ không mang nghĩa bảo mật (`sky`, `violet`) vẫn dùng trực tiếp.

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

### Nhãn & `Tooltip`

Mọi nhãn của workspace (nút topbar, công tắc mode, nút trace, tab Inspector, tiêu đề chip payload) lấy từ một nguồn duy nhất: `UI_LABELS` trong `core/frontend/src/lib/uiLabels.ts` (import qua `@/lib`). Mỗi mục có `text` hiển thị, `tip` giải thích bằng tiếng Việt và `busy` nếu nút có trạng thái đang chạy. Thuật ngữ đã quen (Vulnerable, Secure, Reset DB, Test My Fix, Replay, Payload) giữ nguyên làm nhãn; phần giải thích nằm trong tooltip.

`Tooltip` (`@/components`) theo mẫu WAI-ARIA tooltip: mở khi rê chuột hoặc khi focus bằng bàn phím, đóng bằng `Esc`, rời chuột hoặc mất focus, và gắn `aria-describedby` vào phần tử được mô tả. Không dùng thuộc tính `title` cho giải thích (không hiện khi dùng bàn phím hay màn hình cảm ứng). Tham số `side="top"` cho control ở đáy panel, `align="end"` cho control sát mép phải.

### `ModeSwitch`

Segmented control hai nửa:

| Nửa | Khi active |
| :--- | :--- |
| Vulnerable | Nền `danger-50`, viền `danger-500`, chữ `danger-700` |
| Secure | Nền `safe-50`, viền `safe-500`, chữ `safe-700` |

### `GlowingCodeLine`

Dòng ứng với bước trace đang active:

* Viền trái `3px` theo `status`.
* Nền mờ theo `status` và glow `box-shadow: inset 0 0 12px rgba(...)`.
* **Inline Callout** trượt xuống (`200ms`) ngay dưới dòng: `Bước N: <title>` và `detail` bằng font mono.

### `FlowPipeline`

Ba node `1. MiniShop UI` → `2. FastAPI` → `3. PostgreSQL`:

| Trạng thái | Hiển thị |
| :--- | :--- |
| `idle` | Viền xám nét đứt, chữ `slate-600`; không dùng `opacity` để chữ vẫn đạt tương phản WCAG AA |
| `active` | Viền theo `status` + vòng sáng `ring-4` khi trace đang chạy tới tầng này |
| `completed` | Giữ màu trạng thái nghiêm trọng nhất đã gặp |

Mỗi node bấm được để nhảy tới bước đầu tiên của tầng và dòng code tương ứng. Thứ tự nghiêm trọng: `info` < `safe` < `warning` < `danger`.

### `PayloadChipBar`

Chip dạng pill (`rounded-full`, `border-dashed`). Bấm chip điền dữ liệu vào form và kích hoạt hiệu ứng nháy ô nhập (`450ms`). Chip vừa chọn chuyển sang viền liền (`aria-pressed`), và mô tả của nó hiện thành dòng chữ ngay dưới hàng chip, không chỉ nằm trong tooltip.

## 6. Khoảng cách & bo góc

| Thuộc tính | Giá trị |
| :--- | :--- |
| Lưới cơ sở | Bội số `4px` (`4, 8, 12, 16, 24`) |
| Bo góc card / container | `12px` (`rounded-xl`) |
| Bo góc button / input / callout | `8px` (`rounded-lg`) |
| Bo góc badge / chip | `9999px` (`rounded-full`) |
| Chiều cao topbar | `56px` (`h-14`) |

Từ breakpoint `lg` trở lên, khung app cao đúng một màn hình (`h-screen`) và workspace chia hai cột chiếm phần còn lại dưới topbar; trang ngoài không cuộn, mỗi cột cuộn độc lập. Dưới `lg`, hai bề mặt xếp chồng thành một cột.
