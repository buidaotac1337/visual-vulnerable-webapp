import { memo, useState } from 'react';
import type { JSX } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  GitCompare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import type { LabStepProgress } from '@/hooks';
import type { InspectorTab, LabMode } from '@/types';

/** Props for the 4-step interactive learning checklist card. */
export interface LabStepperCardProps {
  labTitle: string;
  progress: LabStepProgress;
  mode: LabMode;
  activeTab: InspectorTab;
  /** Whether the 4-step list starts expanded (defaults to `true`). */
  defaultExpanded?: boolean;
  onSwitchMode: (mode: LabMode) => void;
  onOpenDiff: () => void;
  onOpenVerify: () => void;
}

interface StepItem {
  id: string;
  title: string;
  description: string;
  done: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

function countCompleted(progress: LabStepProgress): number {
  let count = 0;
  if (progress.exploredVulnerable) count += 1;
  if (progress.comparedSecure) count += 1;
  if (progress.viewedDiff) count += 1;
  if (progress.passedVerify) count += 1;
  return count;
}

function StepRow({ step, index }: { step: StepItem; index: number }): JSX.Element {
  return (
    <li
      className={`flex items-start justify-between gap-2.5 rounded-large border px-3 py-2 text-xs ${
        step.done ? 'border-success-subtle bg-success' : 'border-default bg-surface-sunken'
      }`}
    >
      <div className="flex items-start gap-2">
        {step.done ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-subtlest" aria-hidden="true" />
        )}
        <div>
          <p className={`font-semibold ${step.done ? 'text-success-bolder' : 'text-default'}`}>
            {index + 1}. {step.title}
          </p>
          <p className="mt-0.5 text-subtle">{step.description}</p>
        </div>
      </div>

      {step.actionLabel && step.onAction ? (
        <button
          type="button"
          onClick={step.onAction}
          className="shrink-0 cursor-pointer rounded-medium border border-brand-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium text-brand hover:bg-brand-subtlest"
        >
          {step.actionLabel}
        </button>
      ) : null}
    </li>
  );
}

function buildSteps(
  progress: LabStepProgress,
  mode: LabMode,
  activeTab: InspectorTab,
  onSwitchMode: (mode: LabMode) => void,
  onOpenDiff: () => void,
  onOpenVerify: () => void,
): StepItem[] {
  const canSwitchSecure = !progress.comparedSecure && mode !== 'secure';
  const canOpenDiff = !progress.viewedDiff && activeTab !== 'diff';
  return [
    {
      id: 'vulnerable',
      title: 'Thử tấn công',
      description: 'Ở chế độ Vulnerable, chọn payload mẫu và gửi yêu cầu.',
      done: progress.exploredVulnerable,
    },
    {
      id: 'secure',
      title: 'So sánh bản vá',
      description: 'Gạt sang Secure và gửi lại để thấy cách ngăn chặn.',
      done: progress.comparedSecure,
      actionLabel: canSwitchSecure ? 'Chuyển sang Secure' : undefined,
      onAction: canSwitchSecure ? () => onSwitchMode('secure') : undefined,
    },
    {
      id: 'diff',
      title: 'Xem Diff',
      description: 'So sánh từng dòng code lỗi ↔ bản vá trong Inspector.',
      done: progress.viewedDiff,
      actionLabel: canOpenDiff ? 'Mở tab Diff' : undefined,
      onAction: canOpenDiff ? onOpenDiff : undefined,
    },
    {
      id: 'verify',
      title: 'Tự vá & chấm bài',
      description: 'Sửa vulnerable.* và bấm Test My Fix để kiểm tra.',
      done: progress.passedVerify,
      actionLabel: !progress.passedVerify ? 'Mở Test My Fix' : undefined,
      onAction: !progress.passedVerify ? onOpenVerify : undefined,
    },
  ];
}

/**
 * Display the interactive 4-step learning checklist for the active lab
 * (exploit in Vulnerable, compare Secure, inspect Diff, and pass Test My Fix).
 *
 * @param props - Active lab title, step progress, workspace mode/tab, and quick-action callbacks.
 * @returns Collapsible 4-step progress card.
 */
function LabStepperCardInner({
  labTitle,
  progress,
  mode,
  activeTab,
  defaultExpanded = true,
  onSwitchMode,
  onOpenDiff,
  onOpenVerify,
}: LabStepperCardProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const completedCount = countCompleted(progress);
  const allDone = completedCount === 4;
  const steps = buildSteps(progress, mode, activeTab, onSwitchMode, onOpenDiff, onOpenVerify);

  return (
    <section
      aria-label={`Tiến độ 4 bước — ${labTitle}`}
      className="rounded-xlarge border border-default bg-surface-raised shadow-raised"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {allDone ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          ) : (
            <GitCompare className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          )}
          <span className="truncate text-xs font-semibold text-default">
            Lộ trình thực hành: {labTitle}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
              allDone ? 'bg-success-subtler text-success-bolder' : 'bg-brand-subtlest text-brand'
            }`}
          >
            {completedCount} / 4 bước
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Thu gọn lộ trình 4 bước' : 'Mở rộng lộ trình 4 bước'}
          className="cursor-pointer rounded-large p-1 text-subtlest hover:bg-neutral-subtle-hovered hover:text-default"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Tiến độ hoàn thành bài lab"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={4}
        className="h-1 w-full bg-neutral"
      >
        <div
          className={`h-full transition-all duration-200 ${allDone ? 'bg-success-bold' : 'bg-brand-bold'}`}
          style={{ width: `${String((completedCount / 4) * 100)}%` }}
        />
      </div>

      {isExpanded ? (
        <div className="space-y-2 p-3">
          {allDone ? (
            <div className="flex items-center gap-2 rounded-large border border-success-subtle bg-success px-3 py-2 text-xs font-medium text-success-bolder">
              <Sparkles className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>Chúc mừng! Bạn đã hoàn thành cả 4 bước của bài lab này.</span>
            </div>
          ) : null}

          <ol className="space-y-1.5">
            {steps.map((step, index) => (
              <StepRow key={step.id} step={step} index={index} />
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Memoized 4-step interactive learning checklist card for the active lab.
 */
export const LabStepperCard = memo(LabStepperCardInner);
