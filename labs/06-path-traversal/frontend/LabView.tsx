import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { FileDown } from 'lucide-react';

import { AddressBar, LabCard } from '@/components';
import type { LabPayload, LabViewProps } from '@/types';

import { InvoiceViewer } from './InvoiceViewer';
import { buildRenderSteps, readDownload, readInvoices } from './invoiceData';
import type { Invoice } from './invoiceData';

const LAB_ID = '06-path-traversal';

interface OwnedInvoices {
  owner: string | null;
  items: Invoice[];
}

/** Load 'Hóa đơn của tôi' silently whenever the persona, mode, or database changes. */
function useInvoices(props: LabViewProps): Invoice[] {
  const { actor, mode, dbResetSeq, onExecute } = props;
  const [loaded, setLoaded] = useState<OwnedInvoices>({ owner: null, items: [] });
  const executeRef = useRef(onExecute);
  executeRef.current = onExecute;

  useEffect(() => {
    let active = true;
    void executeRef.current('list_invoices', {}, { silent: true }).then((response) => {
      // Keep the last good list if a silent reload fails.
      if (active && response?.ok) {
        setLoaded({ owner: actor, items: readInvoices(response.data) });
      }
    });
    return () => {
      active = false;
    };
  }, [actor, mode, dbResetSeq]);

  // A list kept from another persona (reload failed after a switch) is not this one's.
  return loaded.owner === actor ? loaded.items : [];
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

  return (
    <LabCard
      title="MiniShop · Hóa đơn của tôi"
      icon={<FileDown className="h-4 w-4" aria-hidden="true" />}
      headerRight={<span className="text-xs text-slate-500">Đăng nhập: {actor ?? 'ẩn danh'}</span>}
    >
      <section aria-label="Hóa đơn của tôi" className="flex flex-col gap-1.5">
        {invoices.length === 0 && <p className="text-xs text-slate-500">Chưa có hóa đơn nào.</p>}
        {invoices.map((invoice) => (
          <button
            key={invoice.file}
            type="button"
            disabled={isExecuting}
            onClick={() => download(invoice.file)}
            className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:border-brand-300 hover:bg-brand-50/50 disabled:cursor-not-allowed"
          >
            <span className="font-semibold">{invoice.file}</span>
            <span>
              Đơn #{invoice.orderId} · ${invoice.totalAmount.toFixed(2)}
            </span>
          </button>
        ))}
      </section>

      <AddressBar
        id="pt-file"
        ariaLabel="Tên file trên URL"
        prefix="/invoices/download?file="
        value={fileName}
        disabled={isExecuting}
        onChange={(value) => onPayloadChange({ ...payload, file: value })}
        onSubmit={() => {
          if (fileName !== '') {
            download(fileName);
          }
        }}
        submitLabel="Tải"
        busyLabel="Đang tải..."
        isBusy={isExecuting}
        submitDisabled={fileName === ''}
        flashSeq={inputFlashSeq}
      />

      <InvoiceViewer result={result} invoices={invoices} />
    </LabCard>
  );
}
