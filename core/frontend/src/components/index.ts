/** Public barrel exports for core VVWA React components. */
export {
  CodeInspector,
  CodeSnippetView,
  GlowingCodeLine,
  InspectorHeader,
  TraceControls,
  TraceLegendBar,
  TraceSpeedSwitch,
  TraceStepPills,
  UnifiedDiffView,
} from './inspector';
export type {
  InspectorHeaderProps,
  TraceControlsProps,
  TraceLegendBarProps,
  TraceSpeedSwitchProps,
  TraceStepPillsProps,
} from './inspector';
export {
  ColorModeSwitch,
  LabWorkspace,
  LayoutModeSwitch,
  ModeSwitch,
  SplitDivider,
  TopControlBar,
  WorkspaceModals,
} from './layout';
export type { ColorModeSwitchProps, WorkspaceModalsProps } from './layout';
export { FlowPipeline } from './pipeline';
export type { FlowPipelineProps } from './pipeline';
export {
  ActorSwitcher,
  EmptyLabFallback,
  OutcomeCoachPanel,
  PayloadChipBar,
  SandboxPane,
} from './sandbox';
export type { OutcomeCoachPanelProps } from './sandbox';
export {
  AddressBar,
  LabCard,
  PrimaryButton,
  ResultNotice,
  SubTabBar,
  TextField,
  Tooltip,
} from './ui';
export type {
  AddressBarProps,
  LabCardProps,
  PrimaryButtonProps,
  ResultNoticeProps,
  ResultNoticeTone,
  SubTabBarProps,
  SubTabItem,
  TextFieldProps,
} from './ui';
export { VerifyModal } from './verify';
export { GlossaryModal, LabBeginnerCard } from './guide';
export type { GlossaryModalProps, LabBeginnerCardProps } from './guide';
export { LabCatalogModal, LabStepperCard, WelcomeBanner } from './learning';
export type { LabCatalogModalProps, LabStepperCardProps, WelcomeBannerProps } from './learning';
