import { BaselineColorExtractor } from '../tagging/BaselineColorExtractor';
import { type IColorExtractor } from '../tagging/ports';
import { nameForHex } from './colorNaming';
import {
  type GarmentAnalysis,
  type IVisionProvider,
  type VisionAnalysisInput,
} from './visionPorts';

/**
 * The default, always-available analysis engine.
 *
 * Real garment understanding (type, material, neckline, …) needs a trained
 * vision model with network/native access, which is DEFERRED. Rather than
 * fabricate those fields, this provider does only what can be done honestly
 * and deterministically offline: extract the predominant colours from sampled
 * pixels (via {@link BaselineColorExtractor}) and name the primary one.
 *
 * Everything else is left empty so the UI shows "not determined" — never a
 * guess. When a real {@link IVisionProvider} is registered, the analysis
 * service merges its richer output on top of this baseline.
 */
export class BaselineVisionProvider implements IVisionProvider {
  public readonly id = 'baseline-color';

  public constructor(
    private readonly colorExtractor: IColorExtractor = new BaselineColorExtractor(),
  ) {}

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async analyze(input: VisionAnalysisInput): Promise<GarmentAnalysis> {
    const samples = input.colorSamples ?? [];
    if (samples.length === 0) {
      // No pixels sampled → nothing the baseline can honestly say.
      return {};
    }
    const colors = this.colorExtractor.extract(samples, 4);
    const primary = colors[0];
    if (primary === undefined) {
      return {};
    }
    const secondary = colors.slice(1);
    const analysis: Record<string, unknown> = {
      primaryColor: { value: primary, confidence: 0.6, source: 'baseline' },
    };
    const name = nameForHex(primary);
    if (name !== null) {
      analysis['primaryColorName'] = {
        value: name,
        confidence: 0.55,
        source: 'baseline',
      };
    }
    if (secondary.length > 0) {
      analysis['secondaryColors'] = {
        value: secondary,
        confidence: 0.5,
        source: 'baseline',
      };
    }
    return analysis as GarmentAnalysis;
  }
}
