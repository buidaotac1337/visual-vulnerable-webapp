import type { LabExecutionResponse, LabMode, TraceStepDraft } from '@/types';

/** MiniShop product summary returned by list_products. */
export interface ProductSummary {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
}

/** Parsed response payload returned by fetch_product_image. */
export interface SsrfFetchResult {
  fetched: boolean;
  updated: boolean;
  blocked: boolean;
  leakedInternal: boolean;
  productId: number;
  requestedUrl: string;
  finalUrl: string | null;
  statusCode: number | null;
  contentType: string | null;
  sizeBytes: number;
  detectedType: string | null;
  bodyPreview: string | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Parse a list_products execution payload into typed MiniShop product summaries.
 *
 * @param data - Raw response.data object from list_products, or undefined.
 * @returns List of product summaries ordered by backend response.
 */
export function readSsrfProducts(data: Record<string, unknown> | undefined): ProductSummary[] {
  const rawProducts = Array.isArray(data?.products) ? data.products : [];
  return rawProducts.filter(isRecord).map((row) => ({
    id: Number(row.id),
    name: String(row.name ?? ''),
    price: Number(row.price ?? 0),
    imageUrl: String(row.image_url ?? ''),
  }));
}

/**
 * Parse a fetch_product_image response payload into a typed SsrfFetchResult.
 *
 * @param data - Raw response.data object from fetch_product_image, or undefined.
 * @returns Parsed fetch result, or null when response belongs to a different action.
 */
export function readSsrfResult(data: Record<string, unknown> | undefined): SsrfFetchResult | null {
  if (!data || typeof data.fetched !== 'boolean') {
    return null;
  }
  return {
    fetched: data.fetched,
    updated: Boolean(data.updated),
    blocked: Boolean(data.blocked),
    leakedInternal: Boolean(data.leaked_internal),
    productId: Number(data.product_id ?? 1),
    requestedUrl: String(data.requested_url ?? ''),
    finalUrl: asNullableString(data.final_url),
    statusCode: asNullableNumber(data.status_code),
    contentType: asNullableString(data.content_type),
    sizeBytes: Number(data.size_bytes ?? 0),
    detectedType: asNullableString(data.detected_type),
    bodyPreview: typeof data.body_preview === 'string' ? data.body_preview : null,
    error: asNullableString(data.error),
  };
}

/**
 * Build the frontend trace step emitted right before dispatching fetch_product_image.
 *
 * @param labId - Kebab-case lab identifier.
 * @param mode - Active execution mode.
 * @param productId - Target product primary key.
 * @param imageUrl - Candidate image URL supplied by the user.
 * @returns Draft trace step attached to @step:fe-fetch-url.
 */
export function buildFetchStep(
  labId: string,
  mode: LabMode,
  productId: number,
  imageUrl: string,
): TraceStepDraft {
  return {
    layer: 'frontend',
    tag: 'fe-fetch-url',
    status: 'info',
    title: `Gửi URL kiểm tra ảnh cho sản phẩm #${String(productId)}`,
    detail: `POST /api/labs/${labId}/${mode}/fetch_product_image (${imageUrl})`,
  };
}

function renderStep(
  status: TraceStepDraft['status'],
  title: string,
  detail: string,
): TraceStepDraft {
  return { layer: 'frontend', tag: 'fe-render-preview', status, title, detail };
}

function buildResultStep(
  result: SsrfFetchResult,
  outcome: LabExecutionResponse['meta']['outcome'],
): TraceStepDraft {
  if (result.leakedInternal) {
    const target = result.finalUrl ?? result.requestedUrl;
    return renderStep('danger', 'Cảnh báo rò rỉ dữ liệu nội bộ qua SSRF!', target);
  }
  if (result.blocked) {
    const status = outcome === 'blocked' ? 'safe' : 'info';
    return renderStep(status, 'Yêu cầu tải URL đã bị chặn', result.error ?? 'URL bị từ chối.');
  }
  if (result.updated) {
    const detail = `${result.detectedType?.toUpperCase() ?? 'IMG'} · ${String(result.sizeBytes)} B`;
    return renderStep('info', 'Cập nhật ảnh sản phẩm an toàn', detail);
  }
  return renderStep(
    'warning',
    'Không thể cập nhật ảnh sản phẩm',
    result.error ?? 'Phản hồi không phải ảnh hợp lệ.',
  );
}

/**
 * Build frontend trace steps appended after fetch_product_image resolves.
 *
 * @param response - Execution response returned by the backend handler.
 * @returns Draft trace steps attached to @step:fe-render-preview.
 */
export function buildRenderSteps(response: LabExecutionResponse): TraceStepDraft[] {
  if (!response.ok) {
    return [];
  }
  const result = readSsrfResult(response.data);
  return result ? [buildResultStep(result, response.meta.outcome)] : [];
}
