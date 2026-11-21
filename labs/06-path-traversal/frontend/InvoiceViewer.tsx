import type { JSX } from 'react';
import { FileSearch, FileText } from 'lucide-react';

import { ResultNotice } from '@/components';

import { isOwnInvoice, visibleContent } from './invoiceData';
import type { DownloadResult, Invoice } from './invoiceData';

interface InvoiceViewerProps {
  result: DownloadResult | null;
  invoices: readonly Invoice[];
}

/**
 * Viewer for the last downloaded file.
 *
 * @param props - Parsed download result and the user's own invoices.
 * @returns File content, a 'not found' notice, or a hint before the first download.
 */
export function InvoiceViewer({ result, invoices }: InvoiceViewerProps): JSX.Element {
  if (!result) {
    return (
      <p className="text-xs text-slate-500">
        Chọn một hóa đơn trong danh sách hoặc nhập tên file trên thanh địa chỉ.
      </p>
    );
  }
  const content = visibleContent(result);
  if (content === null) {
    return (
      <ResultNotice
        tone="neutral"
        icon={<FileSearch className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
      >
        {result.error ?? 'Không có file.'}
      </ResultNotice>
    );
  }
  const foreign = !isOwnInvoice(result.file, invoices);
  return (
    <article
      aria-label={`Nội dung ${result.file}`}
      className={`flex flex-col gap-2 rounded-lg border p-3 ${foreign ? 'border-danger-300 bg-danger-50/40' : 'border-slate-200 bg-slate-50'}`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
        <FileText className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <span className="break-all">{result.file}</span>
      </p>
      {foreign && (
        <ResultNotice tone="danger">
          File này không nằm trong danh sách hóa đơn của bạn: server đã đọc theo đường dẫn mà client
          gửi lên.
        </ResultNotice>
      )}
      <pre
        className="max-h-56 overflow-auto rounded border border-slate-200 bg-white p-2 text-xs whitespace-pre-wrap break-all text-slate-800"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {content}
      </pre>
    </article>
  );
}
