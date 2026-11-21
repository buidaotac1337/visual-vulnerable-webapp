import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { downloadLabSnippet, resetDatabase, triggerBlobDownload } from '@/lib';
import type { WorkspaceNotice } from '@/types';

/** State and command handlers for Reset DB and ZIP Snippet download (Test My Fix: useLabVerify). */
export interface LabMaintenanceController {
  isResettingDb: boolean;
  isDownloading: boolean;
  handleResetDb: () => Promise<void>;
  handleDownloadSnippet: () => Promise<void>;
}

interface MaintenanceHookDeps {
  selectedLabId: string | null;
  setDbResetSeq: Dispatch<SetStateAction<number>>;
  setNotice: Dispatch<SetStateAction<WorkspaceNotice | null>>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}

/**
 * Manage workspace maintenance actions (1-click Reset DB, ZIP download) with dbResetSeq
 * notifications for stateful LabView plugins.
 *
 * @param deps - Shared workspace refs and state setters.
 * @returns LabMaintenanceController callbacks and verification modal state.
 */
export function useLabMaintenance({
  selectedLabId,
  setDbResetSeq,
  setNotice,
}: MaintenanceHookDeps): LabMaintenanceController {
  const [isResettingDb, setIsResettingDb] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

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
    isDownloading,
    handleResetDb,
    handleDownloadSnippet,
  };
}
