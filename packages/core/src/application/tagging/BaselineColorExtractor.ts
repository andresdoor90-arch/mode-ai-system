import { type IColorExtractor, type RgbSample } from './ports';

const toHex = (n: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, '0');
};

/** Quantise a channel to a bucket centre for grouping similar colours. */
const quantise = (value: number, step: number): number =>
  Math.min(255, Math.round(value / step) * step);

/**
 * Deterministic, dependency-free predominant-colour extractor.
 *
 * Buckets samples into a coarse RGB grid, accumulates weighted counts, then
 * returns the most populated buckets as hex colours. It runs fully offline (no
 * network, no native deps) and is the non-AI colour baseline for AI-assisted
 * tagging — clearly distinct from the deferred vision model.
 */
export class BaselineColorExtractor implements IColorExtractor {
  public constructor(private readonly bucketStep = 32) {}

  public extract(samples: readonly RgbSample[], topN = 3): readonly string[] {
    if (samples.length === 0) {
      return [];
    }
    const buckets = new Map<string, { r: number; g: number; b: number; w: number }>();
    for (const s of samples) {
      const w = s.weight ?? 1;
      const key = [
        quantise(s.r, this.bucketStep),
        quantise(s.g, this.bucketStep),
        quantise(s.b, this.bucketStep),
      ].join(',');
      const acc = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0 };
      acc.r += s.r * w;
      acc.g += s.g * w;
      acc.b += s.b * w;
      acc.w += w;
      buckets.set(key, acc);
    }
    return [...buckets.values()]
      .sort((a, b) => b.w - a.w)
      .slice(0, Math.max(1, topN))
      .map((acc) => `#${toHex(acc.r / acc.w)}${toHex(acc.g / acc.w)}${toHex(acc.b / acc.w)}`);
  }
}
