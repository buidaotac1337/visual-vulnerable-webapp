import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

import type { LabViewProps } from '@/types';

import type { SinkModule } from './frontendVerifier';

interface LabViewModule {
  LabView: ComponentType<LabViewProps>;
}

type LabViewLoader = () => Promise<LabViewModule>;

const LAB_ID_PATTERN = /\/labs\/([^/]+)\/frontend\/LabView\.tsx$/;

const rawLoaders = import.meta.glob<LabViewModule>('../../../../labs/*/frontend/LabView.tsx');

const loaderByLabId = new Map<string, LabViewLoader>();
for (const [modulePath, loader] of Object.entries(rawLoaders)) {
  const match = LAB_ID_PATTERN.exec(modulePath.replaceAll('\\', '/'));
  const labId = match?.[1];
  if (labId) {
    loaderByLabId.set(labId, loader);
  }
}

const SINK_LAB_ID_PATTERN = /\/labs\/([^/]+)\/frontend\/vulnerable\.tsx$/;

const rawSinkLoaders = import.meta.glob<SinkModule>('../../../../labs/*/frontend/vulnerable.tsx');
// Only the presence of secure.tsx matters here: these lazy loaders are never called.
const secureSinkPaths = new Set(
  Object.keys(import.meta.glob('../../../../labs/*/frontend/secure.tsx')).map((modulePath) =>
    modulePath.replaceAll('\\', '/'),
  ),
);

const sinkLoaderByLabId = new Map<string, () => Promise<SinkModule>>();
for (const [modulePath, loader] of Object.entries(rawSinkLoaders)) {
  const normalized = modulePath.replaceAll('\\', '/');
  const labId = SINK_LAB_ID_PATTERN.exec(normalized)?.[1];
  const securePath = normalized.slice(0, -'vulnerable.tsx'.length) + 'secure.tsx';
  // Mirror the backend rule: a lone vulnerable.tsx is not a sink pair (ADR-0006).
  if (labId && secureSinkPaths.has(securePath)) {
    sinkLoaderByLabId.set(labId, loader);
  }
}

/**
 * Load labs/<labId>/frontend/vulnerable.tsx (the frontend sink students patch, ADR-0006),
 * only when secure.tsx also exists, matching the backend's complete-pair rule.
 * In dev, React Refresh keeps rendered components on the latest saved code.
 *
 * @param labId - Kebab-case lab identifier.
 * @returns The module namespace, or null when the lab has no complete frontend sink pair.
 */
export async function loadFrontendSinkModule(labId: string): Promise<SinkModule | null> {
  const loader = sinkLoaderByLabId.get(labId);
  return loader ? loader() : null;
}

const lazyCache = new Map<string, LazyExoticComponent<ComponentType<LabViewProps>>>();

/**
 * Check whether a dynamic frontend LabView plugin exists on disk for labId.
 *
 * @param labId - Kebab-case lab identifier.
 * @returns True if labs/<labId>/frontend/LabView.tsx was discovered by Vite.
 */
export function hasLabView(labId: string): boolean {
  return loaderByLabId.has(labId);
}

/**
 * Return a cached React.lazy component for labs/<labId>/frontend/LabView.tsx.
 *
 * @param labId - Kebab-case lab identifier.
 * @returns Lazy LabView component, or null when the lab has no custom frontend view.
 */
export function getLazyLabView(
  labId: string,
): LazyExoticComponent<ComponentType<LabViewProps>> | null {
  const cached = lazyCache.get(labId);
  if (cached) {
    return cached;
  }
  const loader = loaderByLabId.get(labId);
  if (!loader) {
    return null;
  }
  const LazyComponent = lazy(async () => {
    const mod = await loader();
    return { default: mod.LabView };
  });
  lazyCache.set(labId, LazyComponent);
  return LazyComponent;
}
