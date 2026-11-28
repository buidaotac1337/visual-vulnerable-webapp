import { memo, useMemo } from 'react';
import type { JSX } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { parseUnifiedDiff } from '@/lib';
import type { DiffRowKind } from '@/types';

import { CopyPathButton } from './CopyPathButton';

interface UnifiedDiffViewProps {
  diff: string;
  /** (vulnerable, secure) file names used in the "no difference" message. */
  fileLabels?: readonly [string, string];
  /** Optional workspace-relative path of the editable vulnerable file. */
  editFilePath?: string | null;
}

const ROW_STYLES: Record<DiffRowKind, { row: string; prefix: string }> = {
  hunk: { row: 'bg-neutral text-brand font-semibold', prefix: '' },
  context: { row: 'text-subtle', prefix: ' ' },
  add: { row: 'bg-success-subtler text-success-bolder', prefix: '+' },
  remove: { row: 'bg-danger-subtler text-danger-bolder', prefix: '-' },
};

/**
 * Render a readable unified diff between a vulnerable/secure file pair with dual line gutters.
 *
 * @param props - Unified diff string, optional file labels, and optional editable file path.
 * @returns Rendered UnifiedDiffView panel.
 */
function UnifiedDiffViewInner({
  diff,
  fileLabels = ['vulnerable.py', 'secure.py'],
  editFilePath = null,
}: UnifiedDiffViewProps): JSX.Element {
  const rows = useMemo(() => parseUnifiedDiff(diff), [diff]);

  if (rows.length === 0) {
    return (
      <div className="m-4 flex items-center gap-2 rounded-large border border-success-subtle bg-success p-4 text-xs text-success-bolder">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        <span>
          Không có khác biệt — mã nguồn {fileLabels[0]} hiện khớp với bản mẫu {fileLabels[1]}.
        </span>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-large border border-default bg-surface px-3 py-2 text-micro text-subtle">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-default">Hướng dẫn đọc Diff:</span>
          <span className="inline-flex items-center gap-1">
            <code className="rounded-small bg-danger-subtler px-1 text-danger-bolder">-</code>
            <span>Dòng lỗi cần bỏ/sửa</span>
          </span>
          <span aria-hidden="true" className="text-subtlest">
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <code className="rounded-small bg-success-subtler px-1 text-success-bolder">+</code>
            <span>Dòng an toàn nên thay bằng</span>
          </span>
        </div>
        {editFilePath && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-subtle">Mở sửa:</span>
            <code className="rounded-small bg-surface px-1.5 py-0.5 text-default font-mono">
              {editFilePath}
            </code>
            <CopyPathButton path={editFilePath} label="Sao chép" />
          </div>
        )}
      </div>
      <div className="text-code font-mono">
        {rows.map((row, idx) => {
          const style = ROW_STYLES[row.kind];
          return (
            <div key={idx} className={`flex px-3 py-0.5 ${style.row}`}>
              <span className="w-9 shrink-0 select-none text-right text-xs text-subtle">
                {row.oldLine ?? ''}
              </span>
              <span className="mr-3 w-9 shrink-0 select-none text-right text-xs text-subtle">
                {row.newLine ?? ''}
              </span>
              <span className="mr-1.5 w-3 shrink-0 select-none">{style.prefix}</span>
              <span className="whitespace-pre">{row.content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Memoized unified diff view between a vulnerable/secure file pair with dual line gutters.
 */
export const UnifiedDiffView = memo(UnifiedDiffViewInner);
