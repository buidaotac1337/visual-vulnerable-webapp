import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchLabSource } from '@/lib';
import type { LabSourceResponse, ParsedSourceFile } from '@/types';

/** Reactive state and refresh trigger for live lab source inspection. */
export interface LabSourceSyncState {
  source: LabSourceResponse | null;
  sourceError: string | null;
  isRefreshingSource: boolean;
  refreshSource: (silent?: boolean) => Promise<void>;
}

function isSameParsedFile(
  a: ParsedSourceFile | null | undefined,
  b: ParsedSourceFile | null | undefined,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.code !== b.code || a.line_count !== b.line_count) {
    return false;
  }
  const aKeys = Object.keys(a.steps);
  const bKeys = Object.keys(b.steps);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key) => a.steps[key] === b.steps[key]);
}

function isSameLabSource(prev: LabSourceResponse | null, next: LabSourceResponse): boolean {
  if (!prev || prev.lab_id !== next.lab_id) {
    return false;
  }
  return (
    prev.diff === next.diff &&
    prev.frontend_diff === next.frontend_diff &&
    isSameParsedFile(prev.vulnerable, next.vulnerable) &&
    isSameParsedFile(prev.secure, next.secure) &&
    isSameParsedFile(prev.frontend, next.frontend) &&
    isSameParsedFile(prev.frontend_vulnerable, next.frontend_vulnerable) &&
    isSameParsedFile(prev.frontend_secure, next.frontend_secure)
  );
}

function formatSourceError(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Không thể tải mã nguồn bài lab.';
}

/**
 * Load live source snippets for the selected lab with stale-response protection,
 * content-equality deduplication, and silent auto-refresh when returning focus.
 *
 * @param selectedLabId - Currently selected lab ID, or null when no lab is active.
 * @returns LabSourceSyncState with latest parsed snippets and manual refresh trigger.
 */
export function useLabSourceSync(selectedLabId: string | null): LabSourceSyncState {
  const [source, setSource] = useState<LabSourceResponse | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [isRefreshingSource, setIsRefreshingSource] = useState<boolean>(false);
  const requestSeqRef = useRef<number>(0);

  const refreshSource = useCallback(
    async (silent = false): Promise<void> => {
      const seq = requestSeqRef.current + 1;
      requestSeqRef.current = seq;
      if (!selectedLabId) {
        setSource(null);
        setSourceError(null);
        setIsRefreshingSource(false);
        return;
      }
      if (!silent) {
        setIsRefreshingSource(true);
      }
      try {
        const nextSource = await fetchLabSource(selectedLabId);
        if (requestSeqRef.current === seq) {
          setSource((prev) => (isSameLabSource(prev, nextSource) ? prev : nextSource));
          setSourceError((prev) => (prev === null ? prev : null));
        }
      } catch (error: unknown) {
        if (requestSeqRef.current === seq) {
          setSourceError(formatSourceError(error));
        }
      } finally {
        if (!silent && requestSeqRef.current === seq) {
          setIsRefreshingSource(false);
        }
      }
    },
    [selectedLabId],
  );

  useEffect(() => {
    setSource(null);
    setSourceError(null);
    void refreshSource(false);
  }, [selectedLabId, refreshSource]);

  useEffect(() => {
    if (!selectedLabId) {
      return undefined;
    }
    const handleVisibilityOrFocus = (): void => {
      if (document.visibilityState === 'visible') {
        void refreshSource(true);
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
