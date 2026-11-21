import type { LabExecutionResponse, TraceStepDraft } from '@/types';

/** MiniShop product summary returned by list_products. */
export interface ProductSummary {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
}

/** File entry inside <sandbox>/webroot/ returned by list_products. */
export interface WebrootFile {
  relativePath: string;
  url: string;
  inUploads: boolean;
  sizeBytes: number;
  executableRisk: boolean;
}

/** Combined product catalog and webroot file inventory. */
export interface UploadCatalog {
  products: ProductSummary[];
  files: WebrootFile[];
}

/** Parsed upload_image response data. */
export interface UploadResultData {
  saved: boolean;
  productId: number;
  originalName: string;
  storedName: string | null;
  url: string | null;
  detectedType: string | null;
  escapedUploads: boolean;
  sizeBytes: number;
  error: string | null;
}

const SAFE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const BINARY_PREVIEW_BYTES = 6;
const MAX_TEXT_PREVIEW = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasSafeExtension(name: string | null): boolean {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return SAFE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Parse a list_products response into typed products and webroot file entries.
 *
 * @param data - Raw data object from list_products, or undefined.
 * @returns Parsed catalog and webroot file list.
 */
export function readUploadCatalog(data: Record<string, unknown> | undefined): UploadCatalog {
  const rawProducts = Array.isArray(data?.products) ? data.products : [];
  const rawFiles = Array.isArray(data?.files) ? data.files : [];
  return {
    products: rawProducts.filter(isRecord).map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      price: Number(row.price ?? 0),
      imageUrl: String(row.image_url ?? ''),
    })),
    files: rawFiles.filter(isRecord).map((row) => ({
      relativePath: String(row.relative_path ?? ''),
      url: String(row.url ?? ''),
      inUploads: Boolean(row.in_uploads),
      sizeBytes: Number(row.size_bytes ?? 0),
      executableRisk: Boolean(row.executable_risk),
    })),
  };
}

/**
 * Parse an upload_image response into a typed UploadResultData object.
 *
 * @param data - Raw response data object, or undefined.
 * @returns Parsed upload result, or null when response is not an upload result.
 */
export function readUploadResult(
  data: Record<string, unknown> | undefined,
): UploadResultData | null {
  if (!data || typeof data.saved !== 'boolean') {
    return null;
  }
  return {
    saved: data.saved,
    productId: Number(data.product_id ?? 1),
    originalName: String(data.original_name ?? ''),
    storedName: typeof data.stored_name === 'string' ? data.stored_name : null,
    url: typeof data.url === 'string' ? data.url : null,
    detectedType: typeof data.detected_type === 'string' ? data.detected_type : null,
    escapedUploads: Boolean(data.escaped_uploads),
    sizeBytes: Number(data.size_bytes ?? 0),
    error: typeof data.error === 'string' ? data.error : null,
  };
}

/**
 * Determine whether a saved upload represents an exploited or risky file drop.
 *
 * @param result - Parsed upload result.
 * @returns True if the file escaped uploads/, lacks valid image magic bytes, or has an unsafe extension.
 */
export function isDangerousUpload(result: UploadResultData): boolean {
  if (!result.saved) {
    return false;
  }
  return (
    result.escapedUploads || result.detectedType === null || !hasSafeExtension(result.storedName)
  );
}

/**
 * Decode a base64 payload into a safe plain-text or binary summary string for preview.
 *
 * @param contentB64 - Base64-encoded payload string.
 * @returns Human-readable preview without executing or rendering HTML/SVG.
 */
export function decodeBase64Preview(contentB64: string): string {
  const trimmed = contentB64.trim();
  if (!trimmed) {
    return '(Trống)';
  }
  try {
    const binary = window.atob(trimmed);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const hasControl = bytes.some((b) => b < 32 && b !== 9 && b !== 10 && b !== 13);
    if (hasControl) {
      const hex = Array.from(bytes.slice(0, BINARY_PREVIEW_BYTES))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      return `[Nhị phân · ${String(bytes.length)} B · header: ${hex}]`;
    }
    const text = new TextDecoder().decode(bytes);
    return text.length > MAX_TEXT_PREVIEW ? `${text.slice(0, MAX_TEXT_PREVIEW)}…` : text;
  } catch {
    return '(Base64 không hợp lệ)';
  }
}

/**
 * Read a browser File into a raw base64 string using FileReader (ADR-0007).
 *
 * @param file - Selected File object from an <input type="file">.
 * @returns Base64 content string without the data-URL prefix.
 */
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Không đọc được nội dung file.'));
        return;
      }
      const commaIndex = reader.result.indexOf(',');
      resolve(commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result);
    };
    reader.onerror = () => {
      reject(new Error('Không thể đọc file đã chọn.'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Build frontend trace steps appended after upload_image completes.
 *
 * @param response - Execution response from upload_image.
 * @returns Draft trace steps describing how the UI renders the upload result.
 */
export function buildRenderSteps(response: LabExecutionResponse): TraceStepDraft[] {
  const result = readUploadResult(response.data);
  if (!result) {
    return [];
  }
  if (!result.saved) {
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-upload',
        status: 'info',
        title: 'Hiển thị thông báo từ chối upload',
        detail: result.error ?? 'Upload bị từ chối.',
      },
    ];
  }
  if (isDangerousUpload(result)) {
    return [
      {
        layer: 'frontend',
        tag: 'fe-render-upload',
        status: 'danger',
        title: 'Cảnh báo file nguy hiểm đã ghi vào sandbox webroot',
        detail: `${result.storedName ?? result.originalName} -> ${result.url ?? 'ngoài webroot'}`,
      },
    ];
  }
  return [
    {
      layer: 'frontend',
      tag: 'fe-render-upload',
      status: 'info',
      title: 'Cập nhật ảnh sản phẩm an toàn',
      detail: `${result.storedName ?? ''} (${String(result.sizeBytes)} B)`,
    },
  ];
}
