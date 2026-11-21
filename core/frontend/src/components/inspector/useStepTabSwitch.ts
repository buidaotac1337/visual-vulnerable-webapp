import { useEffect, useRef, useState } from 'react';

import type { InspectorTab } from '@/types';

const TAB_NAMES: Record<InspectorTab, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  diff: 'Diff',
};

/**
 * Follow the active trace step to the tab that holds its code line, and say so.
 *
 * Switching tabs silently during Replay was confusing, so every automatic switch
 * returns a short note for the header. The Diff tab is never left automatically,
 * and a tab the user picks clears the note.
 *
 * @param targetTab - Tab of the active step's code line, or null.
 * @param stepNumber - Number of the active step (re-runs the effect per step).
 * @param activeTab - Tab currently shown.
 * @param onChangeTab - Tab setter of the workspace.
 * @returns Note to show after an automatic switch, and a setter for user tab picks.
 */
export function useStepTabSwitch(
  targetTab: InspectorTab | null,
  stepNumber: number | undefined,
  activeTab: InspectorTab,
  onChangeTab: (tab: InspectorTab) => void,
): { note: string | null; pickTab: (tab: InspectorTab) => void } {
  const [note, setNote] = useState<string | null>(null);
  const activeTabRef = useRef<InspectorTab>(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (!targetTab || activeTabRef.current === 'diff') {
      return;
    }
    if (targetTab === activeTabRef.current) {
      setNote(null);
      return;
    }
    onChangeTab(targetTab);
    setNote(`Bước ${String(stepNumber ?? '')} nằm ở tab ${TAB_NAMES[targetTab]}: đã chuyển tab.`);
  }, [targetTab, stepNumber, onChangeTab]);

  const pickTab = (tab: InspectorTab): void => {
    setNote(null);
    onChangeTab(tab);
  };

  return { note, pickTab };
}
