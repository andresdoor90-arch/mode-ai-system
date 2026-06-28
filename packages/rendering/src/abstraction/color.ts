/**
 * Colour as plain, engine-agnostic data.
 *
 * The renderer is driven by the REAL colours of the garments in the inventory.
 * Each garment carries a hex string (derived in the domain `Color` value
 * object); this module turns that into a {@link ColorDescriptor} with every
 * representation a 3D engine might need — including the sRGB→linear conversion
 * that physically-based renderers (Three.js) expect — WITHOUT importing any
 * engine. The Three.js adapter just reads `.linear` (or `.hex`).
 */
import { clamp, round } from './math';

/** 8-bit RGB channels, each `0..255`. */
export interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Normalised RGB channels, each `0..1`. */
export interface RGBf {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** A fully-derived, immutable colour description for rendering. */
export interface ColorDescriptor {
  /** Canonical lower-case `#rrggbb`. */
  readonly hex: string;
  /** 8-bit channels. */
  readonly rgb: RGB;
  /** sRGB channels in `0..1` (what a CSS/`THREE.Color` setter consumes). */
  readonly srgb: RGBf;
  /** Linear-light channels in `0..1` (for physically-based materials). */
  readonly linear: RGBf;
  /** Relative luminance `0..1` (perceptual brightness). */
  readonly luminance: number;
  /** True when the colour is visually dark (luminance < 0.4). */
  readonly isDark: boolean;
}

/** A safe neutral grey used when a colour cannot be parsed. */
export const FALLBACK_HEX = '#9ca3af';

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** Normalise any accepted hex form to canonical `#rrggbb`, or `null`. */
export const normalizeHex = (hex: string): string | null => {
  const match = HEX_RE.exec(hex.trim());
  if (match === null || match[1] === undefined) {
    return null;
  }
  return `#${match[1].toLowerCase()}`;
};

const channelToLinear = (channel0to1: number): number => {
  // Standard sRGB electro-optical transfer function.
  return channel0to1 <= 0.04045
    ? channel0to1 / 12.92
    : ((channel0to1 + 0.055) / 1.055) ** 2.4;
};

const hexToRgb = (canonicalHex: string): RGB => {
  const body = canonicalHex.slice(1);
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
};

/**
 * Build a {@link ColorDescriptor} from a hex string. Invalid input falls back
 * to {@link FALLBACK_HEX} so the renderer can never crash on bad data.
 */
export const colorFromHex = (hex: string): ColorDescriptor => {
  const canonical = normalizeHex(hex) ?? FALLBACK_HEX;
  const rgb = hexToRgb(canonical);
  const srgb: RGBf = {
    r: round(rgb.r / 255),
    g: round(rgb.g / 255),
    b: round(rgb.b / 255),
  };
  const linear: RGBf = {
    r: round(channelToLinear(srgb.r)),
    g: round(channelToLinear(srgb.g)),
    b: round(channelToLinear(srgb.b)),
  };
  const luminance = round(0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b);
  return {
    hex: canonical,
    rgb,
    srgb,
    linear,
    luminance,
    isDark: luminance < 0.4,
  };
};

/**
 * Mix two colours in sRGB space by `t` (0 = a, 1 = b). Used to derive subtle
 * shading/accent tints (e.g. a slightly darker seam colour) at the data level.
 */
export const mixColors = (
  a: ColorDescriptor,
  b: ColorDescriptor,
  t: number,
): ColorDescriptor => {
  const k = clamp(t, 0, 1);
  const r = Math.round(a.rgb.r + (b.rgb.r - a.rgb.r) * k);
  const g = Math.round(a.rgb.g + (b.rgb.g - a.rgb.g) * k);
  const bl = Math.round(a.rgb.b + (b.rgb.b - a.rgb.b) * k);
  const toHex = (n: number): string => clamp(n, 0, 255).toString(16).padStart(2, '0');
  return colorFromHex(`#${toHex(r)}${toHex(g)}${toHex(bl)}`);
};
