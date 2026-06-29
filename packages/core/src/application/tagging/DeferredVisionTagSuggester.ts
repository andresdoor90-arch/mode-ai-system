import { BaselineColorExtractor } from './BaselineColorExtractor';
import {
  type GarmentTagSuggestion,
  type IColorExtractor,
  type IGarmentTagSuggester,
  type TagSuggestionInput,
} from './ports';

/**
 * The default tag suggester used until a real vision model is wired.
 *
 * The vision model (category/type/material/formality from pixels) is DEFERRED:
 * it requires network access and/or native dependencies that are unavailable
 * offline, so this implementation reports those fields as unavailable and never
 * fabricates them. What it CAN do offline is run the deterministic
 * {@link BaselineColorExtractor} to suggest predominant colours from sampled
 * pixels — a genuine, non-AI baseline.
 *
 * Crucially, even the colours it returns are *suggestions*: the confirmation
 * use case applies nothing without the user's explicit approval.
 */
export class DeferredVisionTagSuggester implements IGarmentTagSuggester {
  public readonly id = 'deferred-vision';

  public constructor(
    private readonly colorExtractor: IColorExtractor = new BaselineColorExtractor(),
  ) {}

  public async isAvailable(): Promise<boolean> {
    // The colour baseline is always available; the vision parts are deferred.
    return true;
  }

  public async suggest(input: TagSuggestionInput): Promise<GarmentTagSuggestion> {
    const samples = input.colorSamples ?? [];
    if (samples.length === 0) {
      // No pixels to analyse offline and no vision model: nothing to suggest.
      return { source: this.id, unavailable: true };
    }
    const colors = this.colorExtractor.extract(samples, 3);
    return {
      source: this.id,
      unavailable: false,
      // Confidence is modest: this is a colour baseline, not a trained model.
      colors: { value: colors, confidence: 0.6 },
    };
  }
}
