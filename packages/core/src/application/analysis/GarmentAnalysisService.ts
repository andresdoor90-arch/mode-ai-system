import { BaselineVisionProvider } from './BaselineVisionProvider';
import { HintRefiner } from './HintRefiner';
import {
  type AnalysisSource,
  type AnalyzedField,
  countPopulatedFields,
  type GarmentAnalysis,
  type IVisionProvider,
  manualFieldsOnly,
  mergeAnalyses,
  overallConfidence,
  sourceRank,
  type VisionAnalysisInput,
  type VisionAnalysisResult,
} from './visionPorts';

/**
 * Orchestrates garment photo analysis across one or more providers.
 *
 * Pipeline: run every AVAILABLE {@link IVisionProvider} (the always-on colour
 * baseline first, then any richer vision model), parse the user's free-text
 * notes with {@link HintRefiner}, then merge everything with explicit
 * precedence (user > vision > baseline). It also derives a friendly name from
 * the merged attributes when no provider supplied one.
 *
 * The service is provider-agnostic: registering a real OpenAI/Ollama provider
 * needs no change here or anywhere downstream — its richer fields simply layer
 * on top of the baseline and below the user's corrections.
 */
export class GarmentAnalysisService {
  private readonly providers: readonly IVisionProvider[];

  public constructor(
    providers?: readonly IVisionProvider[],
    private readonly hintRefiner: HintRefiner = new HintRefiner(),
  ) {
    // The colour baseline is always present so colour is never missing offline.
    this.providers =
      providers !== undefined && providers.length > 0 ? providers : [new BaselineVisionProvider()];
  }

  /** Provider ids registered, in run order. */
  public get providerIds(): readonly string[] {
    return this.providers.map((p) => p.id);
  }

  /**
   * Analyse a freshly added photo.
   *
   * @param input image reference, colour samples and optional free text.
   */
  public async analyze(input: VisionAnalysisInput): Promise<VisionAnalysisResult> {
    return this.run(input, undefined);
  }

  /**
   * Re-analyse after a photo replacement, preserving the user's prior manual
   * corrections where they are still compatible with the new photo.
   *
   * Manual (user-sourced) fields from {@link previous} are layered above the
   * fresh provider output but below any new free-text hints, so the user's
   * earlier edits survive unless they contradict new notes.
   */
  public async reanalyze(
    input: VisionAnalysisInput,
    previous: GarmentAnalysis,
  ): Promise<VisionAnalysisResult> {
    return this.run(input, manualFieldsOnly(previous));
  }

  private async run(
    input: VisionAnalysisInput,
    preservedManual: GarmentAnalysis | undefined,
  ): Promise<VisionAnalysisResult> {
    const ran: string[] = [];
    let visionAvailable = false;
    const providerAnalyses: GarmentAnalysis[] = [];

    for (const provider of this.providers) {
      if (!(await provider.isAvailable())) {
        continue;
      }
      const analysis = await provider.analyze(input);
      providerAnalyses.push(analysis);
      ran.push(provider.id);
      if (provider.id !== 'baseline-color') {
        visionAvailable = true;
      }
    }

    const hints =
      input.freeText !== undefined && input.freeText.trim().length > 0
        ? this.hintRefiner.refine(input.freeText)
        : {};

    const ordered: GarmentAnalysis[] = [...providerAnalyses];
    if (preservedManual !== undefined) {
      ordered.push(preservedManual);
    }
    ordered.push(hints);

    let merged = mergeAnalyses(ordered);
    merged = this.deriveSuggestedName(merged);

    return {
      analysis: merged,
      providers: ran,
      visionAvailable,
      overallConfidence: overallConfidence(merged),
      populatedFields: countPopulatedFields(merged),
    };
  }

  /** Build a readable name from type + material + colour when none exists. */
  private deriveSuggestedName(analysis: GarmentAnalysis): GarmentAnalysis {
    if (analysis.suggestedName !== undefined) {
      return analysis;
    }
    const parts: string[] = [];
    const sources: AnalysisSource[] = [];
    const push = (f: AnalyzedField<string> | undefined): void => {
      if (f !== undefined && f.value.trim().length > 0) {
        parts.push(f.value);
        sources.push(f.source);
      }
    };
    push(analysis.garmentType);
    if (analysis.material !== undefined) {
      parts.push(`de ${analysis.material.value.toLowerCase()}`);
      sources.push(analysis.material.source);
    }
    push(analysis.primaryColorName);

    if (parts.length === 0) {
      return analysis;
    }
    const name = parts.join(' ').replace(/\s+/g, ' ').trim();
    // Use the lowest-ranked contributing source so the name never looks more
    // authoritative than the weakest fact it is built from.
    const source = sources.reduce<AnalysisSource>(
      (lowest, s) => (sourceRank(s) < sourceRank(lowest) ? s : lowest),
      sources[0] ?? 'baseline',
    );
    const confidence = source === 'user' ? 0.8 : 0.5;
    return { ...analysis, suggestedName: { value: name, confidence, source } };
  }
}
