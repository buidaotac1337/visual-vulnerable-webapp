import type { JSX } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import type { HealthResponse, LabMode } from '@/types';

interface HealthBannerProps {
  mode: LabMode;
  health: HealthResponse | null;
  errorMessage: string | null;
}

/**
 * Render the dual-surface status header banner showing active mode and backend readiness.
 *
 * @param props - Component props containing active mode and backend health status.
 * @returns Rendered header banner element.
 */
export function HealthBanner({ mode, health, errorMessage }: HealthBannerProps): JSX.Element {
  const isSecure = mode === 'secure';

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        {isSecure ? (
          <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />
        ) : (
          <ShieldAlert className="h-5 w-5 text-red-500" aria-hidden="true" />
        )}
        <span>VVWA · MiniShop</span>
      </div>

      <div className="flex items-center gap-3 text-xs font-medium">
        {health ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            API: {health.status.toUpperCase()} (v{health.version})
          </span>
        ) : errorMessage ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{errorMessage}</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            Connecting API...
          </span>
        )}
      </div>
    </header>
  );
}
