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
export { parseUnifiedDiff } from './diffParser';
export { UI_LABELS } from './uiLabels';
export type { UiLabel, UiLabelKey } from './uiLabels';
export {
  getFrontendSinkFile,
  isBackendVerifyTest,
  isFrontendVerifyTest,
  resolveFrontendFile,
} from './sourceFiles';
export type { ResolvedFrontendFile } from './sourceFiles';
export { tokenizeCodeAsync, tokenizeCodeSyncFallback } from './highlighter';
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
export {
  computePipelineNodes,
  findFirstStepIndexForLayer,
  mergeExecutionTrace,
  resolveStepTarget,
} from './traceEngine';
