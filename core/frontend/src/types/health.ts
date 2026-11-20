/** Response payload returned by FastAPI GET /api/health. */
export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
}

/** Allowed execution mode for MiniShop security labs. */
export type LabMode = 'vulnerable' | 'secure';
