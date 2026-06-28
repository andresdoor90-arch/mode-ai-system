/**
 * ColorDot — small swatch rendering a garment colour.
 *
 * Renders the colour's hex as a bordered dot with an accessible label. The hex
 * is an inline style (the only legitimate use of a raw colour value in the UI,
 * since it is user data, not a theme token).
 */
import { cn } from '../../lib/cn';

export interface ColorDotProps {
  hex: string;
  name?: string;
  className?: string;
}

export function ColorDot({ hex, name, className }: ColorDotProps): JSX.Element {
  return (
    <span
      className={cn('inline-block h-4 w-4 rounded-full border border-border shadow-sm', className)}
      style={{ backgroundColor: hex }}
      title={name ?? hex}
      role="img"
      aria-label={name ?? hex}
    />
  );
}
