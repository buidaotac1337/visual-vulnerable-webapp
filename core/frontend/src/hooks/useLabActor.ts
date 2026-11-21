import { useCallback, useMemo, useState } from 'react';

import type { LabMetadata } from '@/types';

/** Persona (simulated login session) state for the selected lab (ADR-0005). */
export interface LabActorState {
  /** Personas declared in meta.json `actors`; empty when the lab needs no session. */
  actors: readonly string[];
  /** Active persona sent as X-VVWA-Actor, or null for labs without actors. */
  actor: string | null;
  /** Switch persona; names not declared in `actors` are ignored. */
  setActor: (name: string) => void;
}

const NO_ACTORS: readonly string[] = [];

/**
 * Track the logged-in persona for the selected lab. The choice falls back to the
 * lab's first declared actor whenever the lab changes or the choice is undeclared.
 *
 * @param lab - Currently selected lab metadata, or null.
 * @returns LabActorState with the declared personas, active persona, and setter.
 */
export function useLabActor(lab: LabMetadata | null): LabActorState {
  const labId = lab?.id ?? null;
  const [choice, setChoice] = useState<{ labId: string; actor: string } | null>(null);
  const [seenLabId, setSeenLabId] = useState<string | null>(labId);
  if (seenLabId !== labId) {
    // Lab changed: forget the previous persona so the new lab starts at its default.
    setSeenLabId(labId);
    setChoice(null);
  }
  const actors = useMemo<readonly string[]>(() => lab?.actors ?? NO_ACTORS, [lab]);

  const chosen = choice !== null && choice.labId === labId ? choice.actor : null;
  const actor = chosen !== null && actors.includes(chosen) ? chosen : (actors[0] ?? null);

  const setActor = useCallback(
    (name: string): void => {
      if (labId !== null && actors.includes(name)) {
        setChoice({ labId, actor: name });
      }
    },
    [labId, actors],
  );

  return { actors, actor, setActor };
}
