import { useEffect, useState } from 'react';

import { fetchHealth, fetchLabs } from '@/lib';
import type { HealthResponse, LabMetadata } from '@/types';

/** Bootstrap state loaded on initial mount (backend health + discovered labs). */
export interface LabCatalogState {
  health: HealthResponse | null;
  apiError: string | null;
  labs: readonly LabMetadata[];
  isLoadingLabs: boolean;
  selectedLabId: string | null;
  setSelectedLabId: (labId: string) => void;
}

/**
 * Bootstrap backend readiness and auto-discovered labs on application mount.
 *
 * @returns LabCatalogState containing health metadata, lab list, and selection setter.
 */
export function useLabCatalog(): LabCatalogState {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [labs, setLabs] = useState<readonly LabMetadata[]>([]);
  const [isLoadingLabs, setIsLoadingLabs] = useState<boolean>(true);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchHealth(), fetchLabs()])
      .then(([healthResp, labsResp]) => {
        if (!active) {
          return;
        }
        setHealth(healthResp);
        setApiError(null);
        setLabs(labsResp.labs);
        const firstLab = labsResp.labs[0];
        if (firstLab) {
          setSelectedLabId(firstLab.id);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message =
            error instanceof Error && error.message.length > 0 ? error.message : 'API offline';
          setApiError(message);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingLabs(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return {
    health,
    apiError,
    labs,
    isLoadingLabs,
    selectedLabId,
    setSelectedLabId,
  };
}
