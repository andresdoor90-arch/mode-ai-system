/**
 * Form building blocks.
 *
 * Lightweight, dependency-light field primitives (Label + Field wrapper) that
 * give forms consistent spacing, label typography, hint and error treatment.
 * `Label` wraps Radix Label for correct `htmlFor` association and accessibility.
 */
import * as LabelPrimitive from '@radix-ui/react-label';
import { forwardRef } from 'react';

import { cn } from '../../lib/cn';

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className,
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

/** A labelled field row: label, control (children), optional hint/error. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: FormFieldProps): JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label !== undefined && (
        <Label htmlFor={htmlFor}>
          {label}
          {required === true && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
      )}
      {children}
      {error !== undefined ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : (
        hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
