import { memo, useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileCode2,
  Lightbulb,
  PlayCircle,
} from 'lucide-react';

import { findGlossaryEntry, getLabBeginnerGuide } from '@/lib';
import type { LabMetadata } from '@/types';

/** Props for the collapsible beginner-friendly lab overview card. */
export interface LabBeginnerCardProps {
  /** Active lab metadata used to resolve the beginner guide. */
  lab: LabMetadata;
  /** Callback invoked when the learner clicks a related glossary term chip. */
  onOpenTerm: (termId: string) => void;
}

interface GuideRowProps {
  icon: ReactNode;
  title: string;
  text: string;
  toneClass: string;
}

function GuideRow({ icon, title, text, toneClass }: GuideRowProps): JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-large border border-default bg-surface-raised px-2.5 py-2">
      <span className={`mt-0.5 shrink-0 ${toneClass}`}>{icon}</span>
      <div className="min-w-0 text-xs leading-relaxed text-subtle">
        <span className="font-semibold text-default">{title}: </span>
        <span>{text}</span>
      </div>
    </div>
  );
}

interface FixFileRowProps {
  filePath: string;
  copied: boolean;
  onCopy: (filePath: string) => void;
}

function FixFileRow({ filePath, copied, onCopy }: FixFileRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-medium border border-default bg-surface-sunken px-2 py-1">
      <code className="truncate text-xs text-default font-mono">{filePath}</code>
      <button
        type="button"
        onClick={() => onCopy(filePath)}
        aria-label={`Sao chép đường dẫn ${filePath}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-small border border-default bg-surface-raised px-2 py-0.5 text-xs font-medium text-subtle transition hover:border-brand-subtle hover:text-brand"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3 text-success" aria-hidden="true" />
            <span className="text-success">Đã chép</span>
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" aria-hidden="true" />
            <span>Chép</span>
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Compact collapsible card explaining a lab in plain Vietnamese for beginners:
 * everyday analogy, real-world impact, 10-second first try, editable file paths, and glossary chips.
 *
 * @param props - Active lab metadata and glossary term click handler.
 * @returns Rendered beginner guide card.
 */
function LabBeginnerCardInner({ lab, onOpenTerm }: LabBeginnerCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const guide = getLabBeginnerGuide(lab);

  useEffect(() => {
    if (!copiedPath) {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopiedPath(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedPath]);

  const handleCopyPath = (filePath: string): void => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(filePath).catch(() => undefined);
    }
    setCopiedPath(filePath);
  };

  return (
    <section
      aria-label="Hướng dẫn nhanh cho người mới"
      className="rounded-xlarge border border-brand-subtle bg-brand-subtlest"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-brand transition hover:bg-brand-subtlest"
      >
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
          <span>Hiểu nhanh trong 30 giây</span>
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-micro font-medium text-subtle">
            Người mới
          </span>
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        )}
      </button>

      {expanded ? (
        <div className="space-y-2 border-t border-brand-subtle px-3 py-2.5">
          <GuideRow
            icon={<Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />}
            title="Ví dụ đời thường"
            text={guide.everydayAnalogy}
            toneClass="text-warning"
          />
          <GuideRow
            icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
            title="Tại sao nguy hiểm?"
            text={guide.whyDangerous}
            toneClass="text-danger"
          />
          <GuideRow
            icon={<PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />}
            title="Thử ngay trong 10 giây"
            text={guide.tryFirstHint}
            toneClass="text-brand"
          />

          <div className="space-y-1.5 rounded-large border border-default bg-surface-raised px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-default">
              <FileCode2 className="h-3.5 w-3.5 text-information" aria-hidden="true" />
              <span>File bạn sẽ tự sửa</span>
            </div>
            <div className="space-y-1">
              {guide.fixFiles.map((filePath) => (
                <FixFileRow
                  key={filePath}
                  filePath={filePath}
                  copied={copiedPath === filePath}
                  onCopy={handleCopyPath}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-micro font-medium text-subtle">Thuật ngữ:</span>
            {guide.relatedTermIds.map((termId) => {
              const entry = findGlossaryEntry(termId);
              return (
                <button
                  key={termId}
                  type="button"
                  onClick={() => onOpenTerm(termId)}
                  className="rounded-full border border-brand-subtle bg-surface-raised px-2.5 py-0.5 text-xs font-medium text-brand transition hover:border-brand hover:bg-brand-subtlest"
                >
                  {entry ? entry.term : termId}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Memoized compact collapsible card explaining a lab in plain Vietnamese for beginners.
 */
export const LabBeginnerCard = memo(LabBeginnerCardInner);
