import type { LabMode } from '@/types';

/** One workspace label: the text on screen and an optional Vietnamese explanation tooltip. */
export interface UiLabel {
  text: string;
  /** Vietnamese explanation shown in a Tooltip when the label has a focusable control. */
  tip?: string;
  /** Text while the control is busy, when it has a busy state. */
  busy?: string;
}

/**
 * Single source of truth for workspace labels (design-system §5).
 *
 * Established product terms (Vulnerable, Secure, Reset DB, Test My Fix, Replay, Payload)
 * stay as the visible label; the tooltip explains them in Vietnamese. Components read
 * labels from here instead of hard-coding strings, so a term changes in one place.
 */
export const UI_LABELS = {
  vulnerable: {
    text: 'Vulnerable',
    tip: 'Chạy backend/vulnerable.py: bản có lỗ hổng, cũng là bài làm bạn sẽ sửa.',
  },
  secure: {
    text: 'Secure',
    tip: 'Chạy backend/secure.py: bản tham chiếu đã áp dụng safety pattern, để so sánh.',
  },
  resetDb: {
    text: 'Reset DB',
    busy: 'Đang reset...',
    tip: 'Khôi phục database MiniShop về dữ liệu mẫu ban đầu.',
  },
  testMyFix: {
    text: 'Test My Fix',
    busy: 'Đang kiểm thử...',
    tip: 'Chấm bài làm của bạn trong backend/vulnerable.py, ở chế độ nào cũng vậy.',
  },
  downloadSnippet: {
    text: 'Tải Snippet',
    tip: 'Tải mã nguồn bản lỗi, bản vá, diff và README của lab dạng .zip.',
  },
  prevStep: { text: 'Trước', tip: 'Lùi về bước trace trước.' },
  replay: {
    text: 'Replay',
    busy: 'Đang chạy...',
    tip: 'Phát lại toàn bộ trace từ bước đầu, mỗi bước sáng dòng code tương ứng.',
  },
  nextStep: { text: 'Sau', tip: 'Tiến tới bước trace sau.' },
  playTrace: {
    text: 'Phát',
    tip: 'Tiếp tục phát tự động các bước trace (phím Space).',
  },
  pauseTrace: {
    text: 'Dừng',
    tip: 'Tạm dừng phát tự động tại bước hiện tại (phím Space).',
  },
  replayTrace: {
    text: 'Phát lại',
    tip: 'Phát lại toàn bộ trace từ bước 1 (phím Space).',
  },
  speedManual: {
    text: 'Tay',
    tip: 'Chế độ thủ công: không tự chạy, tự bấm Trước/Sau hoặc phím mũi tên để đi từng bước.',
  },
  speedHalf: {
    text: '0.5×',
    tip: 'Phát chậm (1.2 giây/bước) để dễ đọc câu SQL và chi tiết trace dài.',
  },
  speedNormal: {
    text: '1×',
    tip: 'Tốc độ mặc định (0.6 giây/bước).',
  },
  speedDouble: {
    text: '2×',
    tip: 'Phát nhanh (0.3 giây/bước) để lướt nhanh luồng thực thi.',
  },
  payloads: { text: 'Payload mẫu (1-click điền sẵn)' },
  backendTab: { text: 'Backend (.py)', tip: 'Mã backend của chế độ đang chọn.' },
  frontendTab: { text: 'Frontend (.tsx)', tip: 'Mã giao diện React của lab.' },
  diffTab: { text: 'Diff', tip: 'Những dòng khác nhau giữa bản lỗi và bản vá.' },
  refreshSource: { text: 'Làm mới mã nguồn', tip: 'Đọc lại mã nguồn mới nhất từ đĩa.' },
  layoutSplit: {
    text: 'Song song',
    tip: 'Hiển thị đồng thời MiniShop Sandbox và Code Inspector (có thể kéo thanh chia).',
  },
  layoutCodeFocus: {
    text: 'Tập trung code',
    tip: 'Mở rộng Code & Trace Inspector toàn chiều rộng để đọc mã nguồn dài.',
  },
  layoutFloating: {
    text: 'Sandbox nổi',
    tip: 'Giữ Code Inspector toàn màn hình và đặt MiniShop Sandbox thành thẻ nổi có thể thu gọn.',
  },
  layoutRestoreSplit: {
    text: 'Về Song song',
    tip: 'Quay lại bố cục chia hai cột Song song.',
  },
  labCatalog: {
    text: 'Lộ trình',
    tip: 'Xem danh mục các bài lab theo mức độ từ Cơ bản đến Trung bình và theo dõi tiến độ học.',
  },
  glossary: {
    text: 'Từ điển',
    tip: 'Tra cứu thuật ngữ bảo mật web và giao diện VVWA bằng ví dụ đời thường.',
  },
} as const satisfies Record<string, UiLabel>;

/** Key of a workspace label in UI_LABELS. */
export type UiLabelKey = keyof typeof UI_LABELS;

/**
 * Return the ModeSwitch tooltip for a mode, naming frontend sink files when the lab has one.
 *
 * @param mode - Target lab mode (`vulnerable` or `secure`).
 * @param hasFrontendSink - True when the lab also has `frontend/<mode>.tsx` sink files.
 * @returns Localized Vietnamese tooltip text for the mode button.
 */
export function modeTip(mode: LabMode, hasFrontendSink: boolean): string {
  if (!hasFrontendSink) {
    return UI_LABELS[mode].tip;
  }
  return mode === 'vulnerable'
    ? 'Chạy backend/vulnerable.py và frontend/vulnerable.tsx: bản có lỗ hổng, cũng là bài làm bạn sẽ sửa.'
    : 'Chạy backend/secure.py và frontend/secure.tsx: bản tham chiếu đã áp dụng safety pattern, để so sánh.';
}

/**
 * Return the Test My Fix tooltip, naming `frontend/vulnerable.tsx` when graded in the browser.
 *
 * @param gradesFrontend - True when the lab declares frontend verifyTests.
 * @returns Localized Vietnamese tooltip text for the Test My Fix button.
 */
export function testMyFixTip(gradesFrontend: boolean): string {
  return gradesFrontend
    ? 'Chấm bài làm của bạn trong backend/vulnerable.py và frontend/vulnerable.tsx, ở chế độ nào cũng vậy.'
    : UI_LABELS.testMyFix.tip;
}
