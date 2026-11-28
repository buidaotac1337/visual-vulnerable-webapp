import { useState } from 'react';
import type { JSX } from 'react';
import { Check, Copy, FileCode2 } from 'lucide-react';

/**
 * Beginner hint box showing the exact `labs/<labId>/...` file path(s) to edit
 * along with a 1-click clipboard copy button.
 *
 * @param props - Lab folder identifier and whether a frontend sink file is graded.
 * @returns Rendered beginner file-path hint box.
 */
export function BeginnerFixHint({
  labId,
  hasFrontendTests,
}: {
  labId: string;
  hasFrontendTests: boolean;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const backendPath = `labs/${labId}/backend/vulnerable.py`;
  const frontendPath = `labs/${labId}/frontend/vulnerable.tsx`;
  const copyText = hasFrontendTests ? `${backendPath}\n${frontendPath}` : backendPath;

  const handleCopy = (): void => {
    void navigator.clipboard?.writeText(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="mb-3 rounded-large border border-information-subtle bg-information p-3 text-xs text-information-bolder">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <FileCode2 className="h-3.5 w-3.5 text-information" aria-hidden="true" />
          File cần mở để sửa bài:
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex cursor-pointer items-center gap-1 rounded-small border border-information-subtle bg-surface-raised px-2 py-0.5 text-micro font-medium text-information-bolder hover:bg-information-subtler"
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
          <span>{copied ? 'Đã sao chép' : 'Sao chép đường dẫn'}</span>
        </button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 font-mono">
        <code className="rounded-small bg-surface-raised px-1.5 py-0.5 text-default">
          {backendPath}
        </code>
        {hasFrontendTests && (
          <code className="rounded-small bg-surface-raised px-1.5 py-0.5 text-default">
            {frontendPath}
          </code>
        )}
      </div>
      <p className="mt-1.5 text-micro text-information-bolder">
        Sau khi sửa, bấm{' '}
        <kbd className="rounded-small bg-surface-raised px-1 py-0.5 font-semibold">Ctrl+S</kbd> để
        lưu file rồi bấm <strong>Chạy lại kiểm thử</strong>.
      </p>
    </div>
  );
}
