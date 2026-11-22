import { useCallback, useState } from 'react';

import type { WorkspaceLayoutMode } from '@/types';

import { readStorage, writeStorage } from './storage';

const LAYOUT_MODE_STORAGE_KEY = 'vvwa.layoutMode';
const SPLIT_PERCENT_STORAGE_KEY = 'vvwa.splitPercent';
const DEFAULT_LAYOUT_MODE: WorkspaceLayoutMode = 'split';
const DEFAULT_SPLIT_PERCENT = 50;
const MIN_SPLIT_PERCENT = 30;
const MAX_SPLIT_PERCENT = 70;

/** Reactive layout mode, split ratio, and floating sandbox state for the workspace. */
export interface WorkspaceLayoutController {
  layoutMode: WorkspaceLayoutMode;
  splitPercent: number;
  isFloatingCollapsed: boolean;
  setLayoutMode: (nextMode: WorkspaceLayoutMode) => void;
  setSplitPercent: (nextPercent: number) => void;
  resetSplit: () => void;
  toggleFloatingCollapsed: () => void;
}

function isLayoutMode(value: string | null): value is WorkspaceLayoutMode {
  return value === 'split' || value === 'code-focus' || value === 'floating';
}

function clampSplitPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SPLIT_PERCENT;
  }
  return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
}

function loadInitialLayoutMode(): WorkspaceLayoutMode {
  const stored = readStorage(LAYOUT_MODE_STORAGE_KEY);
  return isLayoutMode(stored) ? stored : DEFAULT_LAYOUT_MODE;
}

function loadInitialSplitPercent(): number {
  const raw = readStorage(SPLIT_PERCENT_STORAGE_KEY);
  if (raw === null || raw.trim() === '') {
    return DEFAULT_SPLIT_PERCENT;
  }
  return clampSplitPercent(Number(raw));
}

/**
 * Manage workspace layout mode (`split`, `code-focus`, `floating`), clamped split ratio
 * (`30..70`), and floating sandbox collapse state with safe `localStorage` persistence.
 *
 * @returns Layout state and callbacks consumed by TopControlBar and LabWorkspace.
 */
export function useWorkspaceLayout(): WorkspaceLayoutController {
  const [layoutMode, setLayoutModeState] = useState<WorkspaceLayoutMode>(loadInitialLayoutMode);
  const [splitPercent, setSplitPercentState] = useState<number>(loadInitialSplitPercent);
  const [isFloatingCollapsed, setIsFloatingCollapsed] = useState<boolean>(false);

  const setLayoutMode = useCallback((nextMode: WorkspaceLayoutMode): void => {
    setLayoutModeState(nextMode);
    writeStorage(LAYOUT_MODE_STORAGE_KEY, nextMode);
    if (nextMode === 'floating') {
      setIsFloatingCollapsed(false);
    }
  }, []);

  const setSplitPercent = useCallback((nextPercent: number): void => {
    const clamped = clampSplitPercent(nextPercent);
    setSplitPercentState(clamped);
    writeStorage(SPLIT_PERCENT_STORAGE_KEY, String(clamped));
  }, []);

  const resetSplit = useCallback((): void => {
    setSplitPercentState(DEFAULT_SPLIT_PERCENT);
    writeStorage(SPLIT_PERCENT_STORAGE_KEY, String(DEFAULT_SPLIT_PERCENT));
  }, []);

  const toggleFloatingCollapsed = useCallback((): void => {
    setIsFloatingCollapsed((prev) => !prev);
  }, []);

  return {
    layoutMode,
    splitPercent,
    isFloatingCollapsed,
    setLayoutMode,
    setSplitPercent,
    resetSplit,
    toggleFloatingCollapsed,
  };
}
