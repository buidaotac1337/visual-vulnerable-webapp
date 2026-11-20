import type { JSX } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { parseUnifiedDiff } from '@/lib';
import type { DiffRowKind } from '@/types';

interface UnifiedDiffViewProps {
  diff: string;
}

const ROW_STYLES: Record<DiffRowKind, { row: string; prefix: string }> = {
  hunk: { row: 'bg-slate-800/80 text-indigo-300 font-semibold', prefix: '' },
  context: { row: 'text-slate-300', prefix: ' ' },
  add: { row: 'bg-emerald-500/15 text-emerald-200', prefix: '+' },
  remove: { row: 'bg-red-500/15 text-red-200', prefix: '-' },
};

/**
 * Render a readable unified diff between vulnerable.py and secure.py with dual line gutters.
 *
 * @param props - Unified diff string returned by GET /api/labs/{id}/source.
 * @returns Rendered UnifiedDiffView panel.
 */
export function UnifiedDiffView({ diff }: UnifiedDiffViewProps): JSX.Element {
  const rows = parseUnifiedDiff(diff);

  if (rows.length === 0) {
    return (
      <div className="m-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/50 p-4 text-xs text-emerald-200">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
        <span>Không có khác biệt — mã nguồn vulnerable.py hiện khớp với bản mẫu secure.py.</span>
      </div>
    );
  }

  return (
    <div className="py-2 text-[13px] leading-[22px]" style={{ fontFamily: 'var(--font-mono)' }}>
      {rows.map((row, idx) => {
        const style = ROW_STYLES[row.kind];
        return (
          <div key={idx} className={`flex px-3 py-0.5 ${style.row}`}>
            <span className="w-9 shrink-0 select-none text-right text-xs text-slate-500">
              {row.oldLine ?? ''}
            </span>
            <span className="mr-3 w-9 shrink-0 select-none text-right text-xs text-slate-500">
              {row.newLine ?? ''}
            </span>
            <span className="mr-1.5 w-3 shrink-0 select-none">{style.prefix}</span>
            <span className="whitespace-pre">{row.content}</span>
          </div>
        );
      })}
    </div>
  );
}
