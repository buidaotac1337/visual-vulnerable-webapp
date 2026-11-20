import { useCallback, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { downloadLabSnippet, resetDatabase, triggerBlobDownload, verifyLab } from '@/lib';
import type { LabMode, VerifyLabResponse, WorkspaceNotice } from '@/types';

/** State and command handlers for Reset DB, Test My Fix, and ZIP Snippet download. */
export interface LabMaintenanceController {
  isResettingDb: boolean;
  isVerifying: boolean;
  isDownloading: boolean;
  verifyResult: VerifyLabResponse | null;
  verifyError: string | null;
  isVerifyModalOpen: boolean;
  handleResetDb: () => Promise<void>;
  handleVerify: () => Promise<void>;
  closeVerifyModal: () => void;
  resetVerifyState: () => void;
  handleDownloadSnippet: () => Promise<void>;
}

interface MaintenanceHookDeps {
  selectedLabId: string | null;
  activeCtxRef: MutableRefObject<{ labId: string | null; mode: LabMode }>;
  refreshSource: () => Promise<void>;
  setDbResetSeq: Dispatch<SetStateAction<number>>;
  setNotice: Dispatch<SetStateAction<WorkspaceNotice | null>>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

/**
 * Manage workspace maintenance actions (1-click Reset DB, Test My Fix modal, ZIP download)
 * with staleness protection and dbResetSeq notifications for stateful LabView plugins.
 *
 * @param deps - Shared workspace refs and state setters.
 * @returns LabMaintenanceController callbacks and verification modal state.
 */
export function useLabMaintenance({
  selectedLabId,
  activeCtxRef,
  refreshSource,
  setDbResetSeq,
  setNotice,
}: MaintenanceHookDeps): LabMaintenanceController {
  const [isResettingDb, setIsResettingDb] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<VerifyLabResponse | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);

  const handleResetDb = useCallback(async (): Promise<void> => {
    setIsResettingDb(true);
    try {
      const resp = await resetDatabase();
      setDbResetSeq((seq) => seq + 1);
      setNotice({
        tone: 'safe',
        message: `Đã khôi phục MiniShop DB (${String(resp.duration_ms)} ms).`,
      });
    } catch (error: unknown) {
      setNotice({ tone: 'danger', message: getErrorMessage(error, 'Không thể Reset DB.') });
    } finally {
      setIsResettingDb(false);
    }
  }, [setDbResetSeq, setNotice]);

  const handleVerify = useCallback(async (): Promise<void> => {
    if (!selectedLabId) {
      return;
    }
    const reqLabId = selectedLabId;
    setIsVerifyModalOpen(true);
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const [result] = await Promise.all([verifyLab(reqLabId, true), refreshSource()]);
      setDbResetSeq((seq) => seq + 1);
      if (activeCtxRef.current.labId === reqLabId) {
        setVerifyResult(result);
      }
    } catch (error: unknown) {
      if (activeCtxRef.current.labId === reqLabId) {
        setVerifyResult(null);
        setVerifyError(getErrorMessage(error, 'Không thể chạy Test My Fix.'));
      }
    } finally {
      if (activeCtxRef.current.labId === reqLabId) {
        setIsVerifying(false);
      }
    }
  }, [selectedLabId, refreshSource, setDbResetSeq, activeCtxRef]);

  const closeVerifyModal = useCallback((): void => {
    setIsVerifyModalOpen(false);
  }, []);

  const resetVerifyState = useCallback((): void => {
    setVerifyResult(null);
    setVerifyError(null);
    setIsVerifyModalOpen(false);
  }, []);

  const handleDownloadSnippet = useCallback(async (): Promise<void> => {
    if (!selectedLabId) {
      return;
    }
    setIsDownloading(true);
    try {
      const blob = await downloadLabSnippet(selectedLabId);
      triggerBlobDownload(blob, `${selectedLabId}-fastapi.zip`);
      setNotice({ tone: 'info', message: `Đã tải gói ${selectedLabId}-fastapi.zip.` });
    } catch (error: unknown) {
      setNotice({ tone: 'danger', message: getErrorMessage(error, 'Không thể tải snippet.') });
    } finally {
      setIsDownloading(false);
    }
  }, [selectedLabId, setNotice]);

  return {
    isResettingDb,
    isVerifying,
    isDownloading,
    verifyResult,
    verifyError,
    isVerifyModalOpen,
    handleResetDb,
    handleVerify,
    closeVerifyModal,
    resetVerifyState,
    handleDownloadSnippet,
  };
}
