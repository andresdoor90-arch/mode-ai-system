/**
 * StatCard — compact KPI tile for the dashboard.
 *
 * Shows a label, a prominent value, an icon and an optional supporting hint
 * (e.g. trend or context). Built on the Card primitive for consistent surface
 * styling.
 */
import type { LucideIcon } from 'lucide-react';

import { Card } from '../ui/card';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
}

export function StatCard({ label, value, icon: Icon, hint }: StatCardProps): JSX.Element {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {hint !== undefined && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
