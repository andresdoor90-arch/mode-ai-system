import { type Color } from '../value-objects/Color';

/** The classic colour-wheel relationships the service recognises. */
export enum ColorHarmonyType {
  Monochromatic = 'monochromatic',
  Analogous = 'analogous',
  Complementary = 'complementary',
  Triadic = 'triadic',
  Neutral = 'neutral',
  Clash = 'clash',
}

/** Angular windows (degrees) defining each harmony relationship. */
const HARMONY_WINDOWS = {
  monochromatic: 15,
  analogous: 45,
  triadicCenter: 120,
  triadicTolerance: 18,
  complementaryMin: 150,
} as const;

/**
 * Pure colour-theory service. Computes colour-wheel relationships and a 0–1
 * harmony score for a set of colours. Neutrals (black/white/greys/very muted
 * tones) are treated as universally compatible, mirroring how they behave in
 * real outfits.
 */
export class ColorHarmonyService {
  /** Hue (deg) of the complementary colour — directly opposite on the wheel. */
  public complementaryHue(color: Color): number {
    return (color.hue + 180) % 360;
  }

  /** The two analogous hues (±30°). */
  public analogousHues(color: Color): readonly [number, number] {
    return [(color.hue + 330) % 360, (color.hue + 30) % 360];
  }

  /** The two triadic hues (±120°). */
  public triadicHues(color: Color): readonly [number, number] {
    return [(color.hue + 120) % 360, (color.hue + 240) % 360];
  }

  /** Classify the relationship between two colours. */
  public relationship(a: Color, b: Color): ColorHarmonyType {
    if (a.isNeutral || b.isNeutral) {
      return ColorHarmonyType.Neutral;
    }
    const d = a.hueDistance(b);
    if (d <= HARMONY_WINDOWS.monochromatic) {
      return ColorHarmonyType.Monochromatic;
    }
    if (d <= HARMONY_WINDOWS.analogous) {
      return ColorHarmonyType.Analogous;
    }
    if (Math.abs(d - HARMONY_WINDOWS.triadicCenter) <= HARMONY_WINDOWS.triadicTolerance) {
      return ColorHarmonyType.Triadic;
    }
    if (d >= HARMONY_WINDOWS.complementaryMin) {
      return ColorHarmonyType.Complementary;
    }
    return ColorHarmonyType.Clash;
  }

  /** A 0–1 pleasantness score for a pair of colours. */
  public pairScore(a: Color, b: Color): number {
    switch (this.relationship(a, b)) {
      case ColorHarmonyType.Neutral:
        return 0.9;
      case ColorHarmonyType.Monochromatic:
        return 0.92;
      case ColorHarmonyType.Analogous:
        return 0.85;
      case ColorHarmonyType.Complementary:
        return 0.8;
      case ColorHarmonyType.Triadic:
        return 0.72;
      case ColorHarmonyType.Clash:
      default:
        return 0.3;
    }
  }

  /**
   * Overall harmony for a palette of colours: the mean of all pairwise scores.
   * A single colour (or none) is trivially harmonious (1).
   */
  public harmonyScore(colors: readonly Color[]): number {
    if (colors.length <= 1) {
      return 1;
    }
    let total = 0;
    let pairs = 0;
    for (let i = 0; i < colors.length; i += 1) {
      for (let j = i + 1; j < colors.length; j += 1) {
        total += this.pairScore(colors[i] as Color, colors[j] as Color);
        pairs += 1;
      }
    }
    return pairs === 0 ? 1 : total / pairs;
  }

  /** Whether a set of colours is free of clashing (non-neutral) pairs. */
  public hasClash(colors: readonly Color[]): boolean {
    for (let i = 0; i < colors.length; i += 1) {
      for (let j = i + 1; j < colors.length; j += 1) {
        if (this.relationship(colors[i] as Color, colors[j] as Color) === ColorHarmonyType.Clash) {
          return true;
        }
      }
    }
    return false;
  }
}
