import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { HealthBanner } from '@/components';
import { fetchHealth } from '@/lib';
import type { HealthResponse, LabMode } from '@/types';

/**
 * Root VVWA Dual-Surface Pedagogy shell demonstrating sandbox and IDE surfaces.
 *
 * @returns Rendered root application layout.
 */
export function App(): JSX.Element {
  const [mode, setMode] = useState<LabMode>('vulnerable');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((payload) => {
        if (active) {
          setHealth(payload);
          setErrorMessage(null);
        }
      })
      .catch(() => {
        if (active) {
          setErrorMessage('API offline (skeleton preview)');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <HealthBanner mode={mode} health={health} errorMessage={errorMessage} />
      <main className="grid flex-1 grid-cols-1 md:grid-cols-2">
        <section className="flex flex-col gap-4 bg-slate-50 p-6">
          <h1 className="text-lg font-semibold text-slate-900">MiniShop Sandbox</h1>
          <p className="text-sm text-slate-600">
            Foundation boilerplate ready. Select a lab mode to preview dual-surface semantics.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('vulnerable')}
              className="rounded-lg border border-red-500 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700"
            >
              Vulnerable
            </button>
            <button
              type="button"
              onClick={() => setMode('secure')}
              className="rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
            >
              Secure
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-3 bg-slate-900 p-6 text-slate-100">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Code &amp; Trace Inspector
          </h2>
          <pre
            className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-200"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {`# Active mode: ${mode}\n# Labs will mount here with live # @step highlighting.`}
          </pre>
        </section>
      </main>
    </div>
  );
}
