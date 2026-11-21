import type { LabExecutionResponse, TraceStepDraft } from '@/types';

/** Invoice of the logged-in user, as list_invoices returns it. */
export interface Invoice {
  orderId: number;
  file: string;
  totalAmount: number;
}

/** Parsed download_invoice result. */
export interface DownloadResult {
  found: boolean;
  file: string;
  content: string | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Read a list_invoices response.
 *
 * @param data - Response data, or undefined.
 * @returns The user's invoices (empty when the response carries none).
 */
export function readInvoices(data: Record<string, unknown> | undefined): Invoice[] {
  const rows = Array.isArray(data?.invoices) ? data.invoices : [];
  return rows.filter(isRecord).map((row) => ({
    orderId: Number(row.order_id),
    file: String(row.file ?? ''),
    totalAmount: Number(row.total_amount),
  }));
}

/**
 * Read a download_invoice response.
 *
 * @param data - Response data, or undefined.
 * @returns Parsed result, or null when the response is not a download result.
 */
export function readDownload(data: Record<string, unknown> | undefined): DownloadResult | null {
  if (!data || typeof data.found !== 'boolean') {
    return null;
  }
  return {
    found: data.found,
    file: String(data.file ?? ''),
    content: typeof data.content === 'string' ? data.content : null,
    error: typeof data.error === 'string' ? data.error : null,
  };
}

/**
 * File content the page actually shows: only for a download marked as found.
 * Shared by InvoiceViewer and buildRenderSteps so the UI and the trace never disagree.
 *
 * @param result - Parsed download result.
 * @returns Content to display, or null for a 'not found' page.
 */
export function visibleContent(result: DownloadResult): string | null {
  return result.found ? result.content : null;
}

/**
 * Whether a returned file is one of the user's own invoices.
 *
 * @param file - File name the client asked for.
 * @param invoices - The user's invoices from list_invoices.
 * @returns True only for a name listed in 'Hóa đơn của tôi'.
 */
export function isOwnInvoice(file: string, invoices: readonly Invoice[]): boolean {
  return invoices.some((invoice) => invoice.file === file);
}

/**
 * Describe what the invoice page shows after the response.
 *
 * @param response - download_invoice response.
 * @param invoices - The user's invoices when the request was sent.
 * @returns Frontend trace step appended after the backend trace.
 */
export function buildRenderSteps(
  response: LabExecutionResponse,
  invoices: readonly Invoice[],
): TraceStepDraft[] {
  const result = readDownload(response.data);
  if (!result) {
    // Not a download result (e.g. a runtime-error envelope): the backend trace says it all.
    return [];
  }
  const content = visibleContent(result);
  if (content === null) {
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-file',
        status: 'info',
        title: 'Hiển thị "Không có hóa đơn"',
        detail: result.error ?? 'Không có file.',
      },
    ];
  }
  const foreign = !isOwnInvoice(result.file, invoices);
  return [
    {
      layer: 'frontend',
      tag: 'fe-render-file',
      status: foreign ? 'danger' : 'info',
      title: foreign ? 'Trình duyệt hiển thị file không phải hóa đơn của bạn' : 'Hiển thị hóa đơn',
      detail: `${result.file}: ${String(content.length)} ký tự`,
    },
  ];
}
