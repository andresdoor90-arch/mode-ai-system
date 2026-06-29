/**
 * EmptyState — friendly placeholder for empty collections / no results.
 *
 * A centred icon, title, description and optional action. Used by filtered
 * lists with no matches so screens communicate state clearly instead of showing
 * a blank area.
 */
import type { LucideIcon } from 'lucide-react';

import { cn } from '../../lib/cn';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description !== undefined && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action !== undefined && <div className="mt-5">{action}</div>}
    </div>
  );
}
