import { useCallback, useMemo, useState } from 'react';

import type { LabMetadata } from '@/types';

import { readStorage, writeStorage } from './storage';

const PROGRESS_STORAGE_KEY = 'vvwa.learningProgress';
const ONBOARDING_STORAGE_KEY = 'vvwa.onboardingDismissed';

/** Per-lab 4-step learning progress persisted in `localStorage`. */
export interface LabStepProgress {
  exploredVulnerable: boolean;
  comparedSecure: boolean;
  viewedDiff: boolean;
  passedVerify: boolean;
}

/** Public controller returned by `useLearningProgress`. */
export interface LearningProgressController {
  progressByLab: Readonly<Record<string, LabStepProgress>>;
  onboardingDismissed: boolean;
  getLabProgress: (labId: string) => LabStepProgress;
  getCompletedStepCount: (labId: string) => number;
  markExploredVulnerable: (labId: string) => void;
  markComparedSecure: (labId: string) => void;
  markViewedDiff: (labId: string) => void;
  markPassedVerify: (labId: string) => void;
  dismissOnboarding: () => void;
  reopenOnboarding: () => void;
  resetProgress: () => void;
  countPassedLabs: (labs: readonly LabMetadata[]) => number;
  findNextRecommendedLab: (
    labs: readonly LabMetadata[],
    currentLabId: string | null,
  ) => LabMetadata | null;
}

const DEFAULT_STEP_PROGRESS: LabStepProgress = {
  exploredVulnerable: false,
  comparedSecure: false,
  viewedDiff: false,
  passedVerify: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStepProgress(raw: unknown): LabStepProgress | null {
  if (!isRecord(raw)) {
    return null;
  }
  return {
    exploredVulnerable: raw.exploredVulnerable === true,
    comparedSecure: raw.comparedSecure === true,
    viewedDiff: raw.viewedDiff === true,
    passedVerify: raw.passedVerify === true,
  };
}

function parseProgressMap(raw: string | null): Record<string, LabStepProgress> {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {};
    }
    const result: Record<string, LabStepProgress> = {};
    for (const [labId, entry] of Object.entries(parsed)) {
      const sanitized = sanitizeStepProgress(entry);
      if (sanitized) {
        result[labId] = sanitized;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function countSteps(progress: LabStepProgress): number {
  let count = 0;
  if (progress.exploredVulnerable) count += 1;
  if (progress.comparedSecure) count += 1;
  if (progress.viewedDiff) count += 1;
  if (progress.passedVerify) count += 1;
  return count;
}

/**
 * Manage beginner 4-step learning progress across all 9 labs and onboarding banner state,
 * persisted safely in `localStorage`.
 *
 * @returns Learning progress state, step mutators, and next-lab recommendation helpers.
 */
export function useLearningProgress(): LearningProgressController {
  const [progressByLab, setProgressByLab] = useState<Record<string, LabStepProgress>>(() =>
    parseProgressMap(readStorage(PROGRESS_STORAGE_KEY)),
  );
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(
    () => readStorage(ONBOARDING_STORAGE_KEY) === 'true',
  );

  const getLabProgress = useCallback(
    (labId: string): LabStepProgress => progressByLab[labId] ?? DEFAULT_STEP_PROGRESS,
    [progressByLab],
  );

  const getCompletedStepCount = useCallback(
    (labId: string): number => countSteps(getLabProgress(labId)),
    [getLabProgress],
  );

  const markStep = useCallback((labId: string, key: keyof LabStepProgress): void => {
    setProgressByLab((prev) => {
      const current = prev[labId] ?? DEFAULT_STEP_PROGRESS;
      if (current[key]) {
        return prev;
      }
      const next: Record<string, LabStepProgress> = {
        ...prev,
        [labId]: { ...current, [key]: true },
      };
      writeStorage(PROGRESS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markExploredVulnerable = useCallback(
    (labId: string): void => markStep(labId, 'exploredVulnerable'),
    [markStep],
  );
  const markComparedSecure = useCallback(
    (labId: string): void => markStep(labId, 'comparedSecure'),
    [markStep],
  );
  const markViewedDiff = useCallback(
    (labId: string): void => markStep(labId, 'viewedDiff'),
    [markStep],
  );
  const markPassedVerify = useCallback(
    (labId: string): void => markStep(labId, 'passedVerify'),
    [markStep],
  );

  const dismissOnboarding = useCallback((): void => {
    setOnboardingDismissed(true);
    writeStorage(ONBOARDING_STORAGE_KEY, 'true');
  }, []);

  const reopenOnboarding = useCallback((): void => {
    setOnboardingDismissed(false);
    writeStorage(ONBOARDING_STORAGE_KEY, 'false');
  }, []);

  const resetProgress = useCallback((): void => {
    setProgressByLab({});
    writeStorage(PROGRESS_STORAGE_KEY, '{}');
  }, []);

  const countPassedLabs = useCallback(
    (labs: readonly LabMetadata[]): number =>
      labs.filter((lab) => progressByLab[lab.id]?.passedVerify === true).length,
    [progressByLab],
  );

  const findNextRecommendedLab = useCallback(
    (labs: readonly LabMetadata[], currentLabId: string | null): LabMetadata | null => {
      if (labs.length === 0) {
        return null;
      }
      const currentIndex = currentLabId ? labs.findIndex((lab) => lab.id === currentLabId) : -1;
      const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
      for (let offset = 0; offset < labs.length; offset += 1) {
        const candidate = labs[(startIndex + offset) % labs.length];
        if (candidate && progressByLab[candidate.id]?.passedVerify !== true) {
          return candidate;
        }
      }
      return null;
    },
    [progressByLab],
  );

  return useMemo(
    () => ({
      progressByLab,
      onboardingDismissed,
      getLabProgress,
      getCompletedStepCount,
      markExploredVulnerable,
      markComparedSecure,
      markViewedDiff,
      markPassedVerify,
      dismissOnboarding,
      reopenOnboarding,
      resetProgress,
      countPassedLabs,
      findNextRecommendedLab,
    }),
    [
      progressByLab,
      onboardingDismissed,
      getLabProgress,
      getCompletedStepCount,
      markExploredVulnerable,
      markComparedSecure,
      markViewedDiff,
      markPassedVerify,
      dismissOnboarding,
      reopenOnboarding,
      resetProgress,
      countPassedLabs,
      findNextRecommendedLab,
    ],
  );
}
