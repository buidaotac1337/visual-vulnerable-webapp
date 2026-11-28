import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { X } from 'lucide-react';

import type { LabMode, VerifyLabResponse } from '@/types';

import { BeginnerFixHint } from './VerifyFixHint';
import { SecureModeNote, VerifyBody, VerifyFooter, VerifySubtitle } from './VerifyModalParts';

/** Props for the Test My Fix verification modal dialog. */
export interface VerifyModalProps {
  isOpen: boolean;
  labTitle: string;
  /** Optional lab folder id (e.g. '01-sql-injection') used to show exact file paths. */
  labId?: string;
  /** True when the lab declares frontend verifyTests, so the subtitle mentions vulnerable.tsx. */
  hasFrontendTests?: boolean;
  /** Workspace mode; in Secure mode the modal reminds that vulnerable.py is what gets graded. */
  mode?: LabMode;
  isLoading: boolean;
  result: VerifyLabResponse | null;
  error: string | null;
  onRerun: () => void;
  onClose: () => void;
  onOpenDiff?: () => void;
  onNextLab?: () => void;
  nextLabTitle?: string | null;
}

/**
 * Render the native <dialog> Test My Fix modal presenting automated verification results:
 * backend tests on backend/vulnerable.py (clean DB per test) and frontend tests on
 * frontend/vulnerable.tsx rendered in an inert document (ADR-0006).
 *
 * @param props - Open state, verification report, error state, and modal callbacks.
 * @returns Rendered VerifyModal dialog element, or null when closed.
 */
export function VerifyModal(props: VerifyModalProps): JSX.Element | null {
  const { isOpen, labTitle, labId, hasFrontendTests = false, mode = 'vulnerable' } = props;
  const { isLoading, result, error, onRerun, onClose, onOpenDiff, onNextLab, nextLabTitle } = props;
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="vvwa-verify-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-full max-w-2xl rounded-xlarge border border-default bg-surface-raised p-0 text-default shadow-overlay"
    >
      <div className="flex items-center justify-between border-b border-default px-5 py-3.5">
        <div>
          <h2 id="vvwa-verify-title" className="text-base font-semibold text-default">
            Test My Fix — {labTitle}
          </h2>
          <VerifySubtitle hasFrontendTests={hasFrontendTests} />
          <SecureModeNote mode={mode} hasFrontendTests={hasFrontendTests} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hộp thoại kiểm thử"
          className="cursor-pointer rounded-large p-1.5 text-subtlest hover:bg-neutral-subtle-hovered hover:text-default"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-5">
        {labId && <BeginnerFixHint labId={labId} hasFrontendTests={hasFrontendTests} />}
        <VerifyBody isLoading={isLoading} result={result} error={error} />
      </div>
      <VerifyFooter
        isLoading={isLoading}
        result={result}
        onRerun={onRerun}
        onClose={onClose}
        onOpenDiff={onOpenDiff}
        onNextLab={onNextLab}
        nextLabTitle={nextLabTitle}
      />
    </dialog>
  );
}
