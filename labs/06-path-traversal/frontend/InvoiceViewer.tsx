import type { JSX } from 'react';
import { FileSearch, FileText, ShieldAlert } from 'lucide-react';

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
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <FileSearch className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>{result.error ?? 'Không có file.'}</span>
      </div>
    );
  }
  const foreign = !isOwnInvoice(result.file, invoices);
  return (
    <article
      aria-label={`Nội dung ${result.file}`}
      className={`flex flex-col gap-2 rounded-lg border p-3 ${foreign ? 'border-red-300 bg-red-50/40' : 'border-slate-200 bg-slate-50'}`}
    >
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
        <FileText className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
        <span className="break-all">{result.file}</span>
      </p>
      {foreign && (
        <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Đây không phải hóa đơn của bạn: server đã trả về một file khác trên máy chủ.</span>
        </p>
      )}
      <pre
        className="max-h-56 overflow-auto rounded border border-slate-200 bg-white p-2 text-[11px] whitespace-pre-wrap break-all text-slate-800"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {content}
      </pre>
    </article>
  );
}
