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
  payloads: { text: 'Payload mẫu (1-click điền sẵn)' },
  backendTab: { text: 'Backend (.py)', tip: 'Mã backend của chế độ đang chọn.' },
  frontendTab: { text: 'Frontend (.tsx)', tip: 'Mã giao diện React của lab.' },
  diffTab: { text: 'Diff', tip: 'Những dòng khác nhau giữa bản lỗi và bản vá.' },
  refreshSource: { text: 'Làm mới mã nguồn', tip: 'Đọc lại mã nguồn mới nhất từ đĩa.' },
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
