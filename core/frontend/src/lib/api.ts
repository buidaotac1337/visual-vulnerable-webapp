import type {
  HealthResponse,
  LabExecutionResponse,
  LabListResponse,
  LabMode,
  LabPayload,
  LabSourceResponse,
  ResetDatabaseResponse,
  VerifyLabResponse,
} from '@/types';

/** Structured error thrown when a VVWA FastAPI request fails. */
export class ApiRequestError extends Error {
  public readonly status: number;

  /**
   * Create a typed API error carrying the HTTP status code.
   *
   * @param message - Human-readable diagnostic message.
   * @param status - HTTP response status code (0 for network failures).
   */
  public constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail.trim().length > 0) {
      return body.detail;
    }
  } catch {
    // Response body was not valid JSON; fall back to status text.
  }
  return `${fallback} (HTTP ${String(response.status)})`;
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  fallback = 'Request failed',
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await extractErrorMessage(response, fallback);
    throw new ApiRequestError(message, response.status);
  }
  return (await response.json()) as T;
}

/**
 * Fetch backend readiness metadata from GET /api/health.
 *
 * @returns Parsed HealthResponse payload.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/api/health', undefined, 'Health check failed');
}

/**
 * Fetch all auto-discovered security labs from GET /api/labs.
 *
 * @returns LabListResponse containing validated LabMetadata entries.
 */
export async function fetchLabs(): Promise<LabListResponse> {
  return requestJson<LabListResponse>('/api/labs', undefined, 'Failed to load labs');
}

/**
 * Fetch live source snippets, @step maps, and unified diff for a lab.
 *
 * @param labId - Kebab-case lab identifier.
 * @returns Parsed LabSourceResponse reflecting latest disk edits.
 */
export async function fetchLabSource(labId: string): Promise<LabSourceResponse> {
  const safeId = encodeURIComponent(labId);
  return requestJson<LabSourceResponse>(
    `/api/labs/${safeId}/source`,
    undefined,
    `Failed to load source for ${labId}`,
  );
}

/**
 * Execute a vulnerable or secure lab handler and return its data + live trace.
 *
 * @param labId - Kebab-case lab identifier.
 * @param mode - Active execution mode ('vulnerable' or 'secure').
 * @param action - Public snake_case async handler name.
 * @param payload - JSON request body sent from MiniShop Sandbox.
 * @returns Unified LabExecutionResponse envelope.
 */
export async function executeLabAction(
  labId: string,
  mode: LabMode,
  action: string,
  payload: LabPayload,
): Promise<LabExecutionResponse> {
  const safeId = encodeURIComponent(labId);
  const safeAction = encodeURIComponent(action);
  return requestJson<LabExecutionResponse>(
    `/api/labs/${safeId}/${mode}/${safeAction}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    `Failed to execute ${action}`,
  );
}

/**
 * Run automated Test My Fix verification against labs/<id>/backend/vulnerable.py.
 *
 * @param labId - Kebab-case lab identifier.
 * @param resetDb - When true (default), resets MiniShop DB before each test case.
 * @returns VerifyLabResponse with aggregate pass status and per-test details.
 */
export async function verifyLab(labId: string, resetDb = true): Promise<VerifyLabResponse> {
  const safeId = encodeURIComponent(labId);
  const query = resetDb ? '?reset_db=true' : '?reset_db=false';
  return requestJson<VerifyLabResponse>(
    `/api/labs/${safeId}/verify${query}`,
    { method: 'POST' },
    `Failed to verify ${labId}`,
  );
}

/**
 * Restore all MiniShop PostgreSQL tables to their clean seed state.
 *
 * @returns ResetDatabaseResponse with confirmation message and duration_ms.
 */
export async function resetDatabase(): Promise<ResetDatabaseResponse> {
  return requestJson<ResetDatabaseResponse>(
    '/api/system/reset-db',
    { method: 'POST' },
    'Failed to reset MiniShop database',
  );
}

/**
 * Download the in-memory ZIP snippet bundle for a lab as a binary Blob.
 *
 * @param labId - Kebab-case lab identifier.
 * @returns ZIP archive Blob ready for client-side download.
 */
export async function downloadLabSnippet(labId: string): Promise<Blob> {
  const safeId = encodeURIComponent(labId);
  const response = await fetch(`/api/labs/${safeId}/download`);
  if (!response.ok) {
    const message = await extractErrorMessage(response, `Failed to download snippet for ${labId}`);
    throw new ApiRequestError(message, response.status);
  }
  return response.blob();
}

/**
 * Trigger a browser file download from an in-memory Blob and revoke its object URL.
 *
 * @param blob - Binary payload to save locally.
 * @param filename - Suggested filename shown in the browser download dialog.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
