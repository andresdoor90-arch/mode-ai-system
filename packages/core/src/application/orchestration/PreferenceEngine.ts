/**
 * Preference Engine — turns learned memory + the user's stored profile into a
 * concrete bias the ranking step can apply.
 *
 * It produces two things:
 *  1. a derived {@link StylePreference} (preferred/avoided colours distilled
 *     from learned affinities, layered over the profile's own preference) that
 *     is fed to the DOMAIN scoring service's `userPreference` factor; and
 *  2. a per-candidate `affinityBias` in [-1, 1] used as a small additive
 *     re-ranking term so previously-accepted styles surface sooner.
 *
 * This is pure M-A-S logic. It never calls a provider and never overrides a
 * hard domain rule — it only influences ordering among already-valid outfits.
 */
import { unwrap } from '../../shared/Result';
import { type Garment } from '../../domain/entities/Garment';
import { StylePreference } from '../../domain/value-objects/StylePreference';
import { type PreferenceMemorySnapshot } from './ports';

/** A threshold above which a learned colour affinity becomes a preference. */
const PREFERRED_THRESHOLD = 0.25;
const AVOIDED_THRESHOLD = -0.25;

export interface DerivedPreferences {
  /** A StylePreference suitable for {@link ScoringContext.stylePreference}. */
  readonly stylePreference: StylePreference;
  /** Names of colours the user has learned to like. */
  readonly preferredColors: readonly string[];
  /** Names of colours the user has learned to avoid. */
  readonly avoidedColors: readonly string[];
}

export class PreferenceEngine {
  /**
   * Distil learned memory (and the optional profile preference) into a single
   * {@link StylePreference}. Learned signals are merged with — and take
   * precedence over — the stored profile preference.
   */
  public derive(memory: PreferenceMemorySnapshot, base?: StylePreference): DerivedPreferences {
    const preferred = new Set<string>(base?.preferredColors ?? []);
    const avoided = new Set<string>(base?.avoidedColors ?? []);

    for (const [color, affinity] of Object.entries(memory.colorAffinity)) {
      if (affinity >= PREFERRED_THRESHOLD) {
        preferred.add(color);
        avoided.delete(color);
      } else if (affinity <= AVOIDED_THRESHOLD) {
        avoided.add(color);
        preferred.delete(color);
      }
    }

    const stylePreference = unwrap(
      StylePreference.create({
        aesthetics: [...(base?.aesthetics ?? [])],
        preferredColors: [...preferred],
        avoidedColors: [...avoided],
        ...(base !== undefined ? { boldnessAffinity: base.boldnessAffinity } : {}),
        ...(base !== undefined ? { comfortPriority: base.comfortPriority } : {}),
      }),
    );

    return {
      stylePreference,
      preferredColors: [...preferred],
      avoidedColors: [...avoided],
    };
  }

  /**
   * A per-outfit affinity bias in [-1, 1]: the average of the learned colour
   * and subcategory affinities of its garments. 0 when nothing has been
   * learned, so a fresh install ranks purely on domain merit.
   */
  public affinityBias(garments: readonly Garment[], memory: PreferenceMemorySnapshot): number {
    if (garments.length === 0) {
      return 0;
    }
    let total = 0;
    let counted = 0;
    for (const garment of garments) {
      const colorName = garment.color.name?.toLowerCase();
      if (colorName !== undefined) {
        total += memory.colorAffinity[colorName] ?? 0;
        counted += 1;
      }
      total += memory.subcategoryAffinity[garment.subcategory] ?? 0;
      counted += 1;
    }
    return counted === 0 ? 0 : total / counted;
  }
}
