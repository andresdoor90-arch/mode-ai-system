/**
 * Skeleton — loading placeholder.
 *
 * A muted, rounded block with an animated shimmer overlay (see the
 * `.skeleton-shimmer` component layer in index.css). Used while IPC data loads
 * so screens reserve layout space instead of flashing empty.
 */
import { cn } from '../../lib/cn';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'skeleton-shimmer relative overflow-hidden rounded-md bg-muted/70',
        className,
      )}
      {...props}
    />
  );
}
