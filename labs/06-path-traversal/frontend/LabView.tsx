import { useEffect, useRef, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { FileDown, Globe } from 'lucide-react';

import type { LabPayload, LabViewProps } from '@/types';

import { InvoiceViewer } from './InvoiceViewer';
import { buildRenderSteps, readDownload, readInvoices } from './invoiceData';
import type { Invoice } from './invoiceData';

const LAB_ID = '06-path-traversal';

/** Load 'Hóa đơn của tôi' silently whenever the persona, mode, or database changes. */
function useInvoices(props: LabViewProps): Invoice[] {
  const { actor, mode, dbResetSeq, onExecute } = props;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;

  useEffect(() => {
    let active = true;
    void executeRef.current('list_invoices', {}, { silent: true }).then((response) => {
      // Keep the last good list if a silent reload fails.
      if (active && response?.ok) {
        setInvoices(readInvoices(response.data));
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq]);

  return invoices;
}

/** File name typed in the address bar (the sandbox payload is the request body). */
function readFileName(payload: LabPayload): string {
  return typeof payload.file === 'string' ? payload.file : '';
}

/**
 * Interactive MiniShop 'my invoices' page for Lab 06 (path traversal on file download).
 *
 * @param props - Standardized VVWA LabViewProps injected by SandboxPane.
 * @returns Rendered invoice list, address bar, and file viewer.
 */
export function LabView(props: LabViewProps): JSX.Element {
  const { mode, actor, payload, onPayloadChange, inputFlashSeq, isExecuting, lastResponse } = props;
  const invoices = useInvoices(props);
  const fileName = readFileName(payload);
  const result = readDownload(lastResponse?.data);
  const flashClass = inputFlashSeq > 0 ? 'vvwa-input-flash' : '';

  // @snippet:start
  const download = (file: string): void => {
    onPayloadChange({ ...payload, file });
    // @step:fe-request-file
    void props.onExecute(
      'download_invoice',
      { file },
      {
        frontendStepsBefore: [
          {
            layer: 'frontend',
            tag: 'fe-request-file',
            status: 'info',
            title: `Tải file "${file}"`,
            detail: `POST /api/labs/${LAB_ID}/${mode}/download_invoice ${JSON.stringify({ file })}`,
          },
        ],
        // @step:fe-render-file
        frontendStepsAfter: (response) => buildRenderSteps(response, invoices),
      },
    );
  };
  // @snippet:end

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (fileName !== '') {
      download(fileName);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <FileDown className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <span>MiniShop · Hóa đơn của tôi</span>
        </div>
        <span className="text-xs text-slate-500">Đăng nhập: {actor ?? 'ẩn danh'}</span>
      </div>

      <section aria-label="Hóa đơn của tôi" className="flex flex-col gap-1.5">
        {invoices.length === 0 && <p className="text-xs text-slate-500">Chưa có hóa đơn nào.</p>}
        {invoices.map((invoice) => (
          <button
            key={invoice.file}
            type="button"
            disabled={isExecuting}
            onClick={() => download(invoice.file)}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50 disabled:cursor-not-allowed"
          >
            <span className="font-semibold">{invoice.file}</span>
            <span>
              Đơn #{invoice.orderId} · ${invoice.totalAmount.toFixed(2)}
            </span>
          </button>
        ))}
      </section>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label
          htmlFor="pt-file"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="shrink-0">/invoices/download?file=</span>
          <input
            key={`f-${String(inputFlashSeq)}`}
            id="pt-file"
            type="text"
            aria-label="Tên file trên URL"
            value={fileName}
            disabled={isExecuting}
            onChange={(event) => onPayloadChange({ ...payload, file: event.target.value })}
            className={`min-w-0 flex-1 bg-transparent text-slate-900 focus:outline-none ${flashClass}`}
          />
        </label>
        <button
          type="submit"
          disabled={isExecuting || fileName === ''}
          className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExecuting ? 'Đang tải...' : 'Tải'}
        </button>
      </form>

      <InvoiceViewer result={result} invoices={invoices} />
    </div>
  );
}
