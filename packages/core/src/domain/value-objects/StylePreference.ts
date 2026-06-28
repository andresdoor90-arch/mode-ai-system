import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../../shared/ValueObject';

/** Broad aesthetic styles a user can lean towards. */
export enum StyleAesthetic {
  Classic = 'classic',
  Minimalist = 'minimalist',
  Streetwear = 'streetwear',
  Bohemian = 'bohemian',
  Sporty = 'sporty',
  Elegant = 'elegant',
  Edgy = 'edgy',
  Preppy = 'preppy',
}

/** How adventurous the user is with bold colours and patterns (0–1). */
interface StylePreferenceProps {
  readonly aesthetics: readonly StyleAesthetic[];
  readonly preferredColors: readonly string[];
  readonly avoidedColors: readonly string[];
  readonly boldnessAffinity: number;
  readonly comfortPriority: number;
}

/**
 * Captures a user's styling preferences. Affinities are normalised to 0–1 so
 * they can be combined directly with the scoring service's weights.
 */
export class StylePreference extends ValueObject<StylePreferenceProps> {
  private constructor(props: StylePreferenceProps) {
    super(props);
  }

  public static create(input: {
    aesthetics?: StyleAesthetic[];
    preferredColors?: string[];
    avoidedColors?: string[];
    boldnessAffinity?: number;
    comfortPriority?: number;
  }): Result<StylePreference, ValidationError> {
    const boldness = input.boldnessAffinity ?? 0.5;
    const comfort = input.comfortPriority ?? 0.5;
    for (const [field, value] of [
      ['boldnessAffinity', boldness],
      ['comfortPriority', comfort],
    ] as const) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        return err(new ValidationError(`${field} must be between 0 and 1.`));
      }
    }
    return ok(
      new StylePreference({
        aesthetics: input.aesthetics ?? [],
        preferredColors: (input.preferredColors ?? []).map((c) => c.toLowerCase()),
        avoidedColors: (input.avoidedColors ?? []).map((c) => c.toLowerCase()),
        boldnessAffinity: boldness,
        comfortPriority: comfort,
      }),
    );
  }

  public get aesthetics(): readonly StyleAesthetic[] {
    return this.props.aesthetics;
  }

  public get preferredColors(): readonly string[] {
    return this.props.preferredColors;
  }

  public get avoidedColors(): readonly string[] {
    return this.props.avoidedColors;
  }

  public get boldnessAffinity(): number {
    return this.props.boldnessAffinity;
  }

  public get comfortPriority(): number {
    return this.props.comfortPriority;
  }
}
