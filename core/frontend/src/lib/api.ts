import type { HealthResponse } from '@/types';

/**
 * Fetch backend readiness metadata from the FastAPI health endpoint.
 *
 * @returns Parsed HealthResponse payload from `/api/health`.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${String(response.status)}`);
  }
  return (await response.json()) as HealthResponse;
}
