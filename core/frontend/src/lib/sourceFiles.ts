import type {
  BackendVerifyTestCase,
  FrontendFileKind,
  FrontendVerifyTestCase,
  LabMode,
  LabSourceResponse,
  ParsedSourceFile,
  VerifyTestCase,
} from '@/types';

/** A frontend file shown in the Frontend tab, with its display path. */
export interface ResolvedFrontendFile {
  kind: FrontendFileKind;
  file: ParsedSourceFile;
  label: string;
}

/**
 * Return the frontend sink file for a mode when the lab has a complete pair (ADR-0006).
 *
 * @param source - Live source response, or null.
 * @param mode - Active lab mode.
 * @returns frontend/<mode>.tsx parsed file, or null without a pair.
 */
export function getFrontendSinkFile(
  source: LabSourceResponse | null,
  mode: LabMode,
): ParsedSourceFile | null {
  if (!source?.frontend_vulnerable || !source.frontend_secure) {
    return null;
  }
  return mode === 'vulnerable' ? source.frontend_vulnerable : source.frontend_secure;
}

/**
 * Pick the file for the Frontend tab: the requested kind when available, otherwise the
 * mode's sink file, otherwise LabView.tsx.
 *
 * @param source - Live source response, or null.
 * @param mode - Active lab mode.
 * @param preferred - File kind requested by the active trace step, if any.
 * @returns Resolved file with label, or null when the lab has no frontend source.
 */
export function resolveFrontendFile(
  source: LabSourceResponse | null,
  mode: LabMode,
  preferred?: FrontendFileKind,
): ResolvedFrontendFile | null {
  const sink = getFrontendSinkFile(source, mode);
  const labView = source?.frontend ?? null;
  if (labView && (preferred === 'labview' || !sink)) {
    return { kind: 'labview', file: labView, label: 'frontend/LabView.tsx' };
  }
  return sink ? { kind: 'sink', file: sink, label: `frontend/${mode}.tsx` } : null;
}

/**
 * Narrow a verifyTests entry to a backend test (missing layer means backend).
 *
 * @param test - Any verifyTests entry from meta.json.
 * @returns True for backend tests graded by POST /api/labs/{id}/verify.
 */
export function isBackendVerifyTest(test: VerifyTestCase): test is BackendVerifyTestCase {
  return test.layer !== 'frontend';
}

/**
 * Narrow a verifyTests entry to a frontend test graded in the browser (ADR-0006).
 *
 * @param test - Any verifyTests entry from meta.json.
 * @returns True for tests with layer 'frontend'.
 */
export function isFrontendVerifyTest(test: VerifyTestCase): test is FrontendVerifyTestCase {
  return test.layer === 'frontend';
}
