import type { JSX, ReactNode } from 'react';
import { AlertTriangle, CircleCheck, Info, ShieldAlert } from 'lucide-react';

export type ResultNoticeTone = 'danger' | 'warning' | 'safe' | 'info' | 'neutral';

export interface ResultNoticeProps {
  /** Semantic severity tone determining colours, default icon, and default ARIA role. */
  tone: ResultNoticeTone;
  /** Optional heading rendered above the body content. */
  title?: string;
  /** Custom icon element; pass null to hide the icon or omit to use the tone default. */
  icon?: ReactNode;
  /** Override the default ARIA role (danger/warning -> 'alert', safe/info -> 'status', neutral -> none; pass null to omit). */
  role?: 'alert' | 'status' | null;
  /** Notice message or structured detail body. */
  children: ReactNode;
  /** Optional extra classes on the notice container. */
  className?: string;
}

const TONE_BOX: Record<ResultNoticeTone, string> = {
  danger: 'border-danger-300 bg-danger-50 text-danger-800',
  warning: 'border-warning-300 bg-warning-50 text-warning-900',
  safe: 'border-safe-200 bg-safe-50 text-safe-800',
  info: 'border-info-200 bg-info-50 text-info-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

const DEFAULT_ROLE: Record<ResultNoticeTone, 'alert' | 'status' | undefined> = {
  danger: 'alert',
  warning: 'alert',
  safe: 'status',
  info: 'status',
  neutral: undefined,
};

function defaultIcon(tone: ResultNoticeTone): ReactNode {
  switch (tone) {
    case 'danger':
      return <ShieldAlert className="h-4 w-4 shrink-0 text-danger-600" aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />;
    case 'safe':
      return <CircleCheck className="h-4 w-4 shrink-0 text-safe-600" aria-hidden="true" />;
    case 'info':
      return <Info className="h-4 w-4 shrink-0 text-info-600" aria-hidden="true" />;
    case 'neutral':
      return null;
  }
}

/**
 * Unified status and security alert banner for MiniShop lab outcomes.
 *
 * @param props - Semantic tone, optional title/icon/role overrides, and body content.
 * @returns Rendered notice container with appropriate colour tokens and ARIA role.
 */
export function ResultNotice({
  tone,
  title,
  icon,
  role,
  children,
  className,
}: ResultNoticeProps): JSX.Element {
  const resolvedRole = role === undefined ? DEFAULT_ROLE[tone] : (role ?? undefined);
  const resolvedIcon = icon === undefined ? defaultIcon(tone) : icon;
  const boxClass = ['rounded-lg border p-3 text-xs', TONE_BOX[tone], className]
    .filter(Boolean)
    .join(' ');

  if (title) {
    return (
      <div role={resolvedRole} className={boxClass}>
        <div className="flex items-center gap-1.5 font-semibold">
          {resolvedIcon}
          <span>{title}</span>
        </div>
        <div className="mt-1">{children}</div>
      </div>
    );
  }

  return (
    <div role={resolvedRole} className={boxClass}>
      <div className="flex items-start gap-2 font-medium">
        {resolvedIcon}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
