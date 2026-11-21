import type { JSX, ReactNode } from 'react';

import type { LabMode, WorkspaceNotice } from '@/types';

interface LabWorkspaceProps {
  mode: LabMode;
  notice: WorkspaceNotice | null;
  leftPane: ReactNode;
  rightPane: ReactNode;
}

const NOTICE_STYLES: Record<WorkspaceNotice['tone'], string> = {
  info: 'border-info-200 bg-info-50 text-info-800',
  safe: 'border-safe-200 bg-safe-50 text-safe-800',
  danger: 'border-danger-200 bg-danger-50 text-danger-800',
};

/**
 * Render the Dual-Surface Pedagogy split-screen workspace filling the space under the top bar
 * with independent vertical scrolling on Light Sandbox and Dark IDE surfaces.
 *
 * @param props - Active lab mode, optional workspace notice, and left/right panes.
 * @returns Rendered main split-screen workspace container.
 */
export function LabWorkspace({
  mode,
  notice,
  leftPane,
  rightPane,
}: LabWorkspaceProps): JSX.Element {
  const modeBorder = mode === 'secure' ? 'border-t-safe-500' : 'border-t-danger-500';

  // Height comes from flex-1 inside the lg:h-screen root (App.tsx), so a taller top bar
  // (e.g. browser zoom) never pushes it past the screen. lg:grid-rows-[minmax(0,1fr)]
  // keeps the single row from growing to its content, so each column scrolls on its own.
  return (
    <main
      className={`grid min-h-0 flex-1 grid-cols-1 border-t-2 lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden ${modeBorder}`}
    >
      <section
        aria-label="MiniShop Sandbox"
        className="flex min-h-0 flex-col gap-4 overflow-y-auto bg-[var(--bg-sandbox)] p-5"
      >
        {notice && (
          <div
            role="status"
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${NOTICE_STYLES[notice.tone]}`}
          >
            {notice.message}
          </div>
        )}
        {leftPane}
      </section>

      <section
        aria-label="Code & Trace Inspector"
        className="vvwa-ide-scroll flex min-h-0 flex-col overflow-hidden border-t border-slate-700 bg-[var(--bg-ide)] text-slate-100 lg:border-t-0 lg:border-l"
      >
        {rightPane}
      </section>
    </main>
  );
}
