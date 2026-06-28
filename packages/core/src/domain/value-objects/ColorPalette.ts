import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../../shared/ValueObject';
import { Color } from './Color';

interface ColorPaletteProps {
  readonly primary: Color;
  readonly secondary: Color;
  readonly accent: Color;
  readonly neutral: Color;
}

/**
 * A four-role colour palette (primary / secondary / accent / neutral) used to
 * describe a user's signature colours and to evaluate how well a garment's
 * colour fits their palette.
 */
export class ColorPalette extends ValueObject<ColorPaletteProps> {
  private constructor(props: ColorPaletteProps) {
    super(props);
  }

  public static create(input: {
    primary: Color;
    secondary: Color;
    accent: Color;
    neutral: Color;
  }): Result<ColorPalette, ValidationError> {
    const roles: ReadonlyArray<[string, Color | undefined]> = [
      ['primary', input.primary],
      ['secondary', input.secondary],
      ['accent', input.accent],
      ['neutral', input.neutral],
    ];
    for (const [role, color] of roles) {
      if (!(color instanceof Color)) {
        return err(new ValidationError(`Palette role "${role}" must be a Color.`));
      }
    }
    return ok(new ColorPalette(input));
  }

  public get primary(): Color {
    return this.props.primary;
  }

  public get secondary(): Color {
    return this.props.secondary;
  }

  public get accent(): Color {
    return this.props.accent;
  }

  public get neutral(): Color {
    return this.props.neutral;
  }

  /** Every colour in the palette as a flat list. */
  public get colors(): readonly Color[] {
    return [this.props.primary, this.props.secondary, this.props.accent, this.props.neutral];
  }

  /** Whether a colour belongs to (closely matches a member of) the palette. */
  public includes(color: Color, hueTolerance = 18): boolean {
    return this.colors.some(
      (member) => member.isNeutral === color.isNeutral && member.hueDistance(color) <= hueTolerance,
    );
  }
}
