import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchLabSource } from '@/lib';
import type { LabSourceResponse } from '@/types';

/** Reactive state and refresh trigger for live lab source inspection. */
export interface LabSourceSyncState {
  source: LabSourceResponse | null;
  sourceError: string | null;
  isRefreshingSource: boolean;
  refreshSource: () => Promise<void>;
}

/**
 * Load live source snippets for the selected lab with stale-response protection
 * and auto-refresh whenever the student returns focus after saving local edits.
 *
 * @param selectedLabId - Currently selected lab ID, or null when no lab is active.
 * @returns LabSourceSyncState with latest parsed snippets and manual refresh trigger.
 */
export function useLabSourceSync(selectedLabId: string | null): LabSourceSyncState {
  const [source, setSource] = useState<LabSourceResponse | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [isRefreshingSource, setIsRefreshingSource] = useState<boolean>(false);
  const requestSeqRef = useRef<number>(0);

  const refreshSource = useCallback(async (): Promise<void> => {
    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;
    if (!selectedLabId) {
      setSource(null);
      setSourceError(null);
      setIsRefreshingSource(false);
      return;
    }
    setIsRefreshingSource(true);
    try {
      const nextSource = await fetchLabSource(selectedLabId);
      if (requestSeqRef.current === seq) {
        setSource(nextSource);
        setSourceError(null);
      }
    } catch (error: unknown) {
      if (requestSeqRef.current === seq) {
        const message =
          error instanceof Error && error.message.length > 0
            ? error.message
            : 'Không thể tải mã nguồn bài lab.';
        setSourceError(message);
      }
    } finally {
      if (requestSeqRef.current === seq) {
        setIsRefreshingSource(false);
      }
    }
  }, [selectedLabId]);

  useEffect(() => {
    setSource(null);
    setSourceError(null);
    void refreshSource();
  }, [selectedLabId, refreshSource]);

  useEffect(() => {
    if (!selectedLabId) {
      return undefined;
    }
    const handleVisibilityOrFocus = (): void => {
      if (document.visibilityState === 'visible') {
        void refreshSource();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [selectedLabId, refreshSource]);

  return { source, sourceError, isRefreshingSource, refreshSource };
}
