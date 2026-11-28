import type { JSX } from 'react';

import type { LabSourceResponse } from '@/types';

import { UnifiedDiffView } from './UnifiedDiffView';

/**
 * Render the Diff tab: backend vulnerable.py ↔ secure.py, plus the frontend sink pair diff.
 *
 * @param props - Live lab source and the lab id used for "edit this file" paths.
 * @returns Rendered unified diff section(s).
 */
export function InspectorDiffTab({
  source,
  labId,
}: {
  source: LabSourceResponse;
  labId: string | null;
}): JSX.Element {
  const backendEditPath = labId ? `labs/${labId}/backend/vulnerable.py` : null;
  const frontendEditPath = labId ? `labs/${labId}/frontend/vulnerable.tsx` : null;
  if (source.frontend_diff == null) {
    return <UnifiedDiffView diff={source.diff} editFilePath={backendEditPath} />;
  }
  return (
    <div>
      <h3 className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-subtle">
        Backend: vulnerable.py ↔ secure.py
      </h3>
      <UnifiedDiffView diff={source.diff} editFilePath={backendEditPath} />
      <h3 className="border-t border-default px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-subtle">
        Frontend: vulnerable.tsx ↔ secure.tsx
      </h3>
      <UnifiedDiffView
        diff={source.frontend_diff}
        fileLabels={['vulnerable.tsx', 'secure.tsx']}
        editFilePath={frontendEditPath}
      />
    </div>
  );
}
