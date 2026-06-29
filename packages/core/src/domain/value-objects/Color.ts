import { type Result, ok, err } from '../../shared/Result';
import { ValidationError } from '../../shared/errors';
import { ValueObject } from '../../shared/ValueObject';
import { Season } from './Season';

/** RGB channel triple, each component in the inclusive range 0–255. */
export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** HSL representation: hue 0–360, saturation/lightness 0–100. */
export interface HSL {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

/**
 * Broad colour "temperature" family used by the harmony rules. Reds/oranges/
 * yellows read as warm, greens/blues/violets as cool, and very desaturated or
 * near-black/white tones as neutral.
 */
export enum ColorCategory {
  Warm = 'warm',
  Cool = 'cool',
  Neutral = 'neutral',
}

interface ColorProps {
  readonly hex: string;
  readonly rgb: RGB;
  readonly hsl: HSL;
  readonly name: string | undefined;
  readonly category: ColorCategory;
  readonly seasons: readonly Season[];
}

const HEX_PATTERN = /^#?([0-9a-fA-F]{6})$/;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const rgbToHex = ({ r, g, b }: RGB): string => {
  const toHex = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const rgbToHsl = ({ r, g, b }: RGB): HSL => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

const hslToRgb = ({ h, s, l }: HSL): RGB => {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) {
    [r1, g1, b1] = [c, x, 0];
  } else if (hp < 2) {
    [r1, g1, b1] = [x, c, 0];
  } else if (hp < 3) {
    [r1, g1, b1] = [0, c, x];
  } else if (hp < 4) {
    [r1, g1, b1] = [0, x, c];
  } else if (hp < 5) {
    [r1, g1, b1] = [x, 0, c];
  } else {
    [r1, g1, b1] = [c, 0, x];
  }
  const m = ln - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
};

/** Classify a colour into a warm/cool/neutral family from its HSL hue. */
const categorize = ({ h, s, l }: HSL): ColorCategory => {
  if (s <= 12 || l <= 8 || l >= 95) {
    return ColorCategory.Neutral;
  }
  // Warm: reds, oranges, yellows and magentas (hue near the red end).
  if (h < 75 || h >= 300) {
    return ColorCategory.Warm;
  }
  return ColorCategory.Cool;
};

/** Suggest the seasons a colour reads best in, from lightness/saturation. */
const seasonsFor = ({ s, l }: HSL): readonly Season[] => {
  if (l >= 70 && s >= 40) {
    return [Season.Spring, Season.Summer];
  }
  if (l <= 35) {
    return [Season.Autumn, Season.Winter];
  }
  if (s <= 25) {
    return [Season.AllSeason];
  }
  return [Season.Spring, Season.Autumn];
};

/**
 * Colour value object. Constructed from a hex string (or RGB/HSL) and derives
 * every other representation, plus a temperature category and the seasons it
 * suits. Immutable and compared structurally.
 */
export class Color extends ValueObject<ColorProps> {
  private constructor(props: ColorProps) {
    super(props);
  }

  public static fromHex(hex: string, name?: string): Result<Color, ValidationError> {
    const match = HEX_PATTERN.exec(hex.trim());
    if (match === null || match[1] === undefined) {
      return err(new ValidationError(`"${hex}" is not a valid 6-digit hex colour.`));
    }
    const normalized = match[1].toLowerCase();
    const rgb: RGB = {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
    return ok(Color.fromComputed(rgb, name));
  }

  public static fromRgb(rgb: RGB, name?: string): Result<Color, ValidationError> {
    for (const [channel, value] of Object.entries(rgb)) {
      if (!Number.isFinite(value) || value < 0 || value > 255) {
        return err(new ValidationError(`RGB channel "${channel}" must be between 0 and 255.`));
      }
    }
    return ok(Color.fromComputed(rgb, name));
  }

  public static fromHsl(hsl: HSL, name?: string): Result<Color, ValidationError> {
    if (hsl.h < 0 || hsl.h > 360 || hsl.s < 0 || hsl.s > 100 || hsl.l < 0 || hsl.l > 100) {
      return err(new ValidationError('HSL values are out of range.'));
    }
    return ok(Color.fromComputed(hslToRgb(hsl), name));
  }

  private static fromComputed(rgb: RGB, name?: string): Color {
    const hsl = rgbToHsl(rgb);
    return new Color({
      hex: rgbToHex(rgb),
      rgb,
      hsl,
      name,
      category: categorize(hsl),
      seasons: seasonsFor(hsl),
    });
  }

  public get hex(): string {
    return this.props.hex;
  }

  public get rgb(): RGB {
    return this.props.rgb;
  }

  public get hsl(): HSL {
    return this.props.hsl;
  }

  public get name(): string | undefined {
    return this.props.name;
  }

  public get category(): ColorCategory {
    return this.props.category;
  }

  public get seasons(): readonly Season[] {
    return this.props.seasons;
  }

  /** Hue in degrees (0–360). */
  public get hue(): number {
    return this.props.hsl.h;
  }

  /** Whether this colour is a desaturated/black/white "neutral". */
  public get isNeutral(): boolean {
    return this.props.category === ColorCategory.Neutral;
  }

  /** Smallest angular distance between two hues, in degrees (0–180). */
  public hueDistance(other: Color): number {
    const diff = Math.abs(this.hue - other.hue) % 360;
    return diff > 180 ? 360 - diff : diff;
  }
}
