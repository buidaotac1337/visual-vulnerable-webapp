import type { JSX } from 'react';
import { AlertTriangle, FileImage, ShieldCheck } from 'lucide-react';

import { ResultNotice } from '@/components';

import type { SsrfFetchResult } from './ssrfData';

export interface PreviewCardProps {
  /** Parsed outcome of the latest fetch_product_image call, or null prior to submission. */
  result: SsrfFetchResult | null;
}

function renderStatusNotice(result: SsrfFetchResult): JSX.Element {
  if (result.leakedInternal) {
    return (
      <ResultNotice tone="danger" title="Phát hiện SSRF — Rò rỉ phản hồi nội bộ!">
        <p>
          Backend đã kết nối tới <code>{result.finalUrl ?? result.requestedUrl}</code> và đọc được
          dữ liệu không phải ảnh từ mạng nội bộ!
        </p>
      </ResultNotice>
    );
  }
  if (result.updated) {
    return (
      <ResultNotice tone="safe" title="Ảnh sản phẩm đã được kiểm tra và cập nhật">
        <p>
          Định dạng hợp lệ: <strong>{result.detectedType?.toUpperCase() ?? 'IMAGE'}</strong> (
          {result.sizeBytes} B) · Nguồn: <code>{result.finalUrl ?? result.requestedUrl}</code>
        </p>
      </ResultNotice>
    );
  }
  if (result.blocked) {
    return (
      <ResultNotice
        tone="safe"
        title="Đã chặn yêu cầu URL không hợp lệ"
        icon={<ShieldCheck className="h-4 w-4 shrink-0 text-safe-600" aria-hidden="true" />}
      >
        <p>{result.error ?? 'URL bị từ chối bởi chính sách chống SSRF.'}</p>
      </ResultNotice>
    );
  }
  return (
    <ResultNotice tone="warning" title="Không thể tải ảnh từ URL">
      <p>{result.error ?? 'Máy chủ đích không trả về ảnh hợp lệ.'}</p>
    </ResultNotice>
  );
}

function hasMetadata(result: SsrfFetchResult): boolean {
  return result.statusCode !== null || result.finalUrl !== null || result.contentType !== null;
}

/**
 * Render HTTP fetch metadata, safe image badge, or leaked internal response preview for Lab 09.
 *
 * @param props - Latest fetch_product_image outcome.
 * @returns Rendered status notice, metadata grid, and optional leaked body viewer.
 */
export function PreviewCard({ result }: PreviewCardProps): JSX.Element {
  if (!result) {
    return (
      <p className="text-xs text-slate-500">
        Chọn sản phẩm và nhập URL ảnh hoặc bấm payload mẫu, sau đó bấm{' '}
        <strong>Kiểm tra &amp; Cập nhật ảnh</strong>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {renderStatusNotice(result)}

      {hasMetadata(result) ? (
        <dl
          aria-label="Thông số phản hồi HTTP"
          className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-2"
        >
          <div>
            <dt className="text-slate-500">HTTP Status</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">{result.statusCode ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Content-Type / Kích thước</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {result.contentType ?? '—'} ({result.sizeBytes} B)
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Final URL</dt>
            <dd
              className="mt-0.5 break-all text-slate-800"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {result.finalUrl ?? result.requestedUrl}
            </dd>
          </div>
        </dl>
      ) : null}

      {result.updated ? (
        <div className="flex items-center gap-2 rounded-lg border border-safe-200 bg-safe-50 px-3 py-2 text-xs text-safe-800">
          <FileImage className="h-4 w-4 shrink-0 text-safe-600" aria-hidden="true" />
          <span>
            Đã xác thực magic bytes <strong>{result.detectedType?.toUpperCase()}</strong> — an toàn
            để lưu vào danh mục MiniShop.
          </span>
        </div>
      ) : null}

      {result.leakedInternal ? (
        <section
          aria-label="Dữ liệu nội bộ bị rò rỉ"
          className="flex flex-col gap-1.5 rounded-lg border border-danger-300 bg-danger-50 p-3"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-danger-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />
            <span>Nội dung phản hồi nội bộ bị lộ (body_preview)</span>
          </div>
          <pre
            className="max-h-48 overflow-auto rounded-md border border-danger-200 bg-white p-2.5 text-xs text-danger-900"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {result.bodyPreview ?? '(Phản hồi trống)'}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
