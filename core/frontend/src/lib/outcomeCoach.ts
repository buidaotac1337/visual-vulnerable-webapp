import type { LabMode, SamplePayload, TraceOutcome } from '@/types';

/** One-click next action suggested by OutcomeCoachPanel. */
export type CoachCtaKind =
  | 'switch-to-secure'
  | 'switch-to-vulnerable'
  | 'open-diff'
  | 'open-verify';

/** Pedagogical coaching message derived from execution mode and outcome. */
export interface OutcomeCoaching {
  tone: 'danger' | 'safe' | 'info' | 'warning';
  badgeLabel: string;
  headline: string;
  explanation: string;
  ctaKind: CoachCtaKind | null;
  ctaLabel: string | null;
}

/** Intent classification for sample payload chips. */
export type PayloadIntent = 'attack' | 'normal';

const ATTACK_KEYWORDS: readonly string[] = [
  'bypass',
  'union',
  'xss',
  'onerror',
  'javascript:',
  'svg',
  'ssrf',
  'traversal',
  'toctou',
  'redirect',
  'lách',
  'giả mạo',
  'ghi đè',
  'quét cổng',
  'loopback',
  'metadata',
  'admin/config',
  'cấu hình bí mật',
  '/etc/passwd',
  'role: admin',
  'tự nạp tiền',
  'số lượng âm',
  'bù trừ',
  'sửa giá',
  'đổi url',
  'dò đơn',
  'bắn đồng thời',
  'nội bộ',
  'đoán được',
  'khai thác',
  'tiêm ',
];

const NORMAL_KEYWORDS: readonly string[] = [
  'luồng hợp lệ',
  'luồng bình thường',
  'luồng bị từ chối hợp lệ',
  'luồng từ chối hợp lệ',
  'thường',
  'hợp lệ',
  'bình thường',
  'chính chủ',
  'của mình',
  'xem trang',
  'không tồn tại',
  'sai định dạng',
];

function targetFilesLabel(hasFrontendSink: boolean): string {
  return hasFrontendSink ? 'vulnerable.py / vulnerable.tsx' : 'vulnerable.py';
}

const COACHING_BY_KEY: Record<string, (hasFrontendSink: boolean) => OutcomeCoaching> = {
  'vulnerable:exploited': (hasFrontendSink) => ({
    tone: 'danger',
    badgeLabel: 'BỊ KHAI THÁC (EXPLOITED)',
    headline: 'Lỗ hổng vừa bị khai thác thành công!',
    explanation: `Yêu cầu vừa vượt qua cơ chế kiểm tra trong ${targetFilesLabel(hasFrontendSink)}. Hãy bật sang chế độ Secure để xem bản vá xử lý tình huống này như thế nào.`,
    ctaKind: 'switch-to-secure',
    ctaLabel: 'Gạt sang Secure để so sánh',
  }),
  'vulnerable:blocked': (hasFrontendSink) => ({
    tone: 'safe',
    badgeLabel: 'ĐÃ CHẶN (BLOCKED)',
    headline: `Tốt lắm! Bản ${targetFilesLabel(hasFrontendSink)} đã chặn được payload`,
    explanation:
      'Mã nguồn thực hành của bạn đã từ chối thành công yêu cầu tấn công này. Hãy chạy Test My Fix để chấm toàn bộ kịch bản kiểm thử tự động.',
    ctaKind: 'open-verify',
    ctaLabel: 'Chạy Test My Fix để chấm bài',
  }),
  'vulnerable:normal': () => ({
    tone: 'info',
    badgeLabel: 'BÌNH THƯỜNG (NORMAL)',
    headline: 'Thao tác hợp lệ diễn ra bình thường',
    explanation:
      'Đây là luồng người dùng hợp lệ. Bạn hãy thử chọn một chip "Thử tấn công" ở trên để quan sát cách lỗ hổng bị khai thác.',
    ctaKind: null,
    ctaLabel: null,
  }),
  'secure:blocked': () => ({
    tone: 'safe',
    badgeLabel: 'ĐÃ CHẶN (BLOCKED)',
    headline: 'Bản an toàn đã vô hiệu hóa cuộc tấn công',
    explanation:
      'Chế độ Secure đã kiểm tra và chặn đứng payload độc hại trước khi gây hậu quả. Mở tab Diff để xem chính xác dòng code đã được vá.',
    ctaKind: 'open-diff',
    ctaLabel: 'Xem Diff bản vá',
  }),
  'secure:normal': () => ({
    tone: 'info',
    badgeLabel: 'BÌNH THƯỜNG (NORMAL)',
    headline: 'Bản an toàn vẫn giữ nguyên trải nghiệm hợp lệ',
    explanation:
      'Bản vá tốt phải chặn được tấn công nhưng không làm hỏng thao tác bình thường của người dùng. Xem tab Diff để đối chiếu cách cài đặt.',
    ctaKind: 'open-diff',
    ctaLabel: 'Xem Diff bản vá',
  }),
  'secure:exploited': () => ({
    tone: 'warning',
    badgeLabel: 'BỊ KHAI THÁC (EXPLOITED)',
    headline: 'Cảnh báo bất thường ở chế độ Secure',
    explanation:
      'Payload này vẫn đạt trạng thái khai thác dù đang ở chế độ Secure. Hãy kiểm tra từng bước trace và đối chiếu lại ở tab Diff.',
    ctaKind: 'open-diff',
    ctaLabel: 'Xem Diff bản vá',
  }),
};

/**
 * Derive beginner-friendly coaching feedback from the current lab mode and execution outcome.
 *
 * @param mode - Active lab execution mode ('vulnerable' or 'secure').
 * @param outcome - High-level execution outcome returned by the backend or frontend sink.
 * @param hasFrontendSink - True when the lab also has a frontend sink file (e.g. Lab 02).
 * @returns Structured coaching badge, headline, explanation, and optional 1-click CTA.
 */
export function deriveOutcomeCoaching(
  mode: LabMode,
  outcome: TraceOutcome,
  hasFrontendSink: boolean,
): OutcomeCoaching {
  if (outcome === 'error') {
    return {
      tone: 'warning',
      badgeLabel: 'LỖI THỰC THI (ERROR)',
      headline: 'Có lỗi cú pháp hoặc thực thi trong code lab',
      explanation: `Hệ thống gặp lỗi khi chạy ${targetFilesLabel(hasFrontendSink)}. Hãy chọn bước runtime-error bên Code Inspector để xem chi tiết dòng lỗi.`,
      ctaKind: null,
      ctaLabel: null,
    };
  }
  const builder = COACHING_BY_KEY[`${mode}:${outcome}`];
  if (builder) {
    return builder(hasFrontendSink);
  }
  return {
    tone: 'info',
    badgeLabel: 'BÌNH THƯỜNG (NORMAL)',
    headline: 'Đã nhận phản hồi từ hệ thống',
    explanation: 'Kiểm tra chi tiết dữ liệu JSON bên dưới và các bước trace bên Code Inspector.',
    ctaKind: null,
    ctaLabel: null,
  };
}

/**
 * Classify a sample payload chip into an attack attempt or a normal legitimate flow.
 *
 * Checks attack indicators first so attack descriptions mentioning "hợp lệ"
 * (e.g. redirect from a valid CDN, valid PNG magic bytes with traversal) stay 'attack'.
 *
 * @param sample - Sample payload metadata from meta.json.
 * @returns 'attack' for exploit/bypass payloads or 'normal' for legitimate flows.
 */
export function classifySamplePayload(sample: SamplePayload): PayloadIntent {
  const haystack = `${sample.label} ${sample.description}`.toLowerCase();
  if (ATTACK_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return 'attack';
  }
  if (NORMAL_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return 'normal';
  }
  return 'attack';
}
