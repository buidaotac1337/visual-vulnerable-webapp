/** Public barrel exports for frontend API clients, trace engine, and utilities. */
export {
  ACTOR_HEADER,
  ApiRequestError,
  downloadLabSnippet,
  executeLabAction,
  fetchHealth,
  fetchLabs,
  fetchLabSource,
  resetDatabase,
  triggerBlobDownload,
  verifyLab,
} from './api';
export {
  alignCompareTraces,
  buildCompareRowTrace,
  retargetStepDrafts,
  rowIndexForSideStep,
  sideIndexAtRow,
} from './compareTrace';
export { parseUnifiedDiff } from './diffParser';
export {
  TONE_CLASSES,
  toneClasses,
  TRACE_OUTCOME_TONE,
  TRACE_STATUS_TONE,
  WORKSPACE_MODE_TONE,
} from './tones';
export type { Tone, ToneClasses } from './tones';
export { modeTip, testMyFixTip, TRACE_OUTCOME_LABELS, UI_LABELS } from './uiLabels';
export type { UiLabel, UiLabelKey } from './uiLabels';
export {
  getFrontendSinkFile,
  isBackendVerifyTest,
  isFrontendVerifyTest,
  resolveFrontendFile,
} from './sourceFiles';
export type { ResolvedFrontendFile } from './sourceFiles';
export { getCachedTokenLines, tokenizeCodeAsync, tokenizeCodeSyncFallback } from './highlighter';
export { getLazyLabView, hasLabView, loadFrontendSinkModule } from './labRegistry';
export { probeDom, isJavascriptUrl } from './domProbe';
export type { DomObservation } from './domProbe';
export { InvalidExpectationError, matchesExpected } from './expectMatcher';
export {
  combineVerifyReports,
  failFrontendVerifyTests,
  renderInInertDocument,
  runFrontendVerifyTests,
} from './frontendVerifier';
export type { SinkModule } from './frontendVerifier';
export { derivePipelineModel, formatHopRoute } from './pipelineWires';
export {
  computePipelineNodes,
  findFirstStepIndexForLayer,
  findNextStepIndexForLayer,
  mergeExecutionTrace,
  resolveStepTarget,
} from './traceEngine';
export { getLabBeginnerGuide, LAB_BEGINNER_GUIDES } from './beginnerContent';
export type { LabBeginnerGuide } from './beginnerContent';
export { filterGlossary, findGlossaryEntry, SECURITY_GLOSSARY } from './securityGlossary';
export type { GlossaryCategory, GlossaryEntry } from './securityGlossary';
export { classifySamplePayload, deriveOutcomeCoaching } from './outcomeCoach';
export type { CoachCtaKind, OutcomeCoaching, PayloadIntent } from './outcomeCoach';
