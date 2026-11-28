import { useCallback, useMemo, useState } from 'react';

import type { ModeOutcomes } from '@/types';

const NO_OUTCOMES: ModeOutcomes = {};

/** Per-lab last outcome of each mode, feeding the ModeSwitch outcome dots. */
export interface ModeOutcomesState {
  modeOutcomes: ModeOutcomes;
  recordOutcomes: (labId: string, next: ModeOutcomes) => void;
}

/**
 * Remember the last execution outcome of each mode per lab for this session.
 *
 * @param selectedLabId - Lab currently on screen, or null.
 * @returns Outcomes of the selected lab and a recorder for any lab.
 */
export function useModeOutcomes(selectedLabId: string | null): ModeOutcomesState {
  const [outcomesByLab, setOutcomesByLab] = useState<Record<string, ModeOutcomes>>({});

  const recordOutcomes = useCallback((labId: string, next: ModeOutcomes): void => {
    setOutcomesByLab((prev) => ({ ...prev, [labId]: { ...prev[labId], ...next } }));
  }, []);

  const modeOutcomes = useMemo<ModeOutcomes>(
    () => (selectedLabId ? (outcomesByLab[selectedLabId] ?? NO_OUTCOMES) : NO_OUTCOMES),
    [selectedLabId, outcomesByLab],
  );

  return { modeOutcomes, recordOutcomes };
}
