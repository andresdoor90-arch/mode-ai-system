/**
 * AnalysisAttributes — presentational summary of a garment photo analysis.
 *
 * Shows the detected colours and the populated attribute rows, each tagged with
 * its provenance (Tú / IA / Color) and confidence. Nothing the analyser could
 * not determine is shown — empty in, empty out — so the user never sees an
 * invented value.
 */
import { Sparkles } from 'lucide-react';

import type { GarmentAnalysisDTO } from '@shared/ipc';

import { confidencePercent, describeAnalysis, sourceLabel } from '../../lib/garmentAnalysis';
import { Badge } from '../ui/badge';

export interface AnalysisAttributesProps {
  analysis: GarmentAnalysisDTO;
  overallConfidence?: number;
}

function ColorSwatch({ hex, label }: { hex: string; label: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-5 w-5 rounded-full border border-border shadow-sm"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function AnalysisAttributes({
  analysis,
  overallConfidence,
}: AnalysisAttributesProps): JSX.Element {
  const rows = describeAnalysis(analysis);
  const primaryHex = analysis.primaryColor?.value;
  const primaryName = analysis.primaryColorName?.value ?? 'Color principal';
  const secondary = analysis.secondaryColors?.value ?? [];

  return (
    <div className="space-y-4">
      {overallConfidence !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Confianza del análisis</span>
          <span className="font-semibold text-foreground">
            {confidencePercent(overallConfidence)}
          </span>
        </div>
      )}

      {(primaryHex !== undefined || secondary.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {primaryHex !== undefined && <ColorSwatch hex={primaryHex} label={primaryName} />}
          {secondary.map((hex) => (
            <ColorSwatch key={hex} hex={hex} label="Secundario" />
          ))}
        </div>
      )}

      {rows.length > 0 ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-2 border-b border-border/50 py-1"
            >
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="flex items-center gap-1.5 text-right text-sm font-medium text-foreground">
                <span>{row.value}</span>
                <Badge variant="outline" className="text-[10px]">
                  {sourceLabel(row.source)} · {confidencePercent(row.confidence)}
                </Badge>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          No se detectaron características automáticamente. Usa el cuadro de ayuda para describir la
          prenda.
        </p>
      )}
    </div>
  );
}
