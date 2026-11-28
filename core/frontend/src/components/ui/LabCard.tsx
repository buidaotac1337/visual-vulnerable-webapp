import type { JSX, ReactNode } from 'react';

export interface LabCardProps {
  /** Card title displayed in the header bar. */
  title: string;
  /** Optional leading icon element styled in the brand accent colour. */
  icon?: ReactNode;
  /** Optional slot on the right of the header bar (e.g. SubTabBar or persona/balance info). */
  headerRight?: ReactNode;
  /** Card body content. */
  children: ReactNode;
  /** Optional extra classes on the outer card container. */
  className?: string;
}

/**
 * Standard MiniShop sandbox card container with a consistent header bar.
 *
 * @param props - Header metadata, optional right-aligned slot, and card body.
 * @returns Rendered MiniShop card container.
 */
export function LabCard({
  title,
  icon,
  headerRight,
  children,
  className,
}: LabCardProps): JSX.Element {
  return (
    <div
      className={[
        'flex flex-col gap-4 rounded-xlarge border border-default bg-surface-raised p-4 shadow-raised',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default pb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-default">
          {icon ? (
            <span className="inline-flex shrink-0 text-brand" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <span>{title}</span>
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
