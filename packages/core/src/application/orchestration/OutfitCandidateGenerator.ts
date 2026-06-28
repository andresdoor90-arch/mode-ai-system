/**
 * Outfit Candidate Generator (step 6 of the flow).
 *
 * Assembles candidate garment combinations from the eligible inventory while
 * respecting the same composition invariants the {@link Outfit} aggregate
 * enforces: exactly one lower-body OR one full-body item (a dress is never
 * combined with separates), at most one pair of shoes and at most one outer
 * layer. Accessories are optional and capped.
 *
 * Generation is deliberately bounded (per-slot and total caps) so the search
 * stays fast on large wardrobes. It produces RAW combinations only — scoring,
 * smart-rule disqualification and ranking happen later, so no business judgment
 * lives here beyond "is this a structurally valid outfit?".
 */
import { type Garment } from '../../domain/entities/Garment';
import { type RecommendationContext } from './types';
import { type Inventory } from './InventoryAnalyzer';

/** A raw candidate: a structurally-valid set of garments. */
export type Candidate = readonly Garment[];

/** How many options to consider per slot, to keep generation bounded. */
const MAX_PER_SLOT = 6;
/** Hard cap on the number of candidate combinations produced. */
const DEFAULT_MAX_CANDIDATES = 400;

export class OutfitCandidateGenerator {
  /** Generate bounded, structurally-valid candidates for the context. */
  public generate(
    inventory: Inventory,
    context: RecommendationContext,
    maxCandidates: number = DEFAULT_MAX_CANDIDATES,
  ): readonly Candidate[] {
    const cap = Math.max(1, maxCandidates);
    const tops = inventory.tops.slice(0, MAX_PER_SLOT);
    const bottoms = inventory.bottoms.slice(0, MAX_PER_SLOT);
    const dresses = inventory.dresses.slice(0, MAX_PER_SLOT);
    const shoes = inventory.shoes.slice(0, MAX_PER_SLOT);
    const outerwear = inventory.outerwear.slice(0, MAX_PER_SLOT);
    const accessories = inventory.accessories.slice(0, MAX_PER_SLOT);

    const candidates: Garment[][] = [];
    const push = (combo: Garment[]): void => {
      if (candidates.length < cap && combo.length > 0) {
        candidates.push(combo);
      }
    };

    const shoeOptions: Array<Garment | null> = shoes.length > 0 ? shoes : [null];
    // Cold weather makes an outer layer desirable but never mandatory.
    const wantsOuter = context.weather?.isCold === true;
    const outerOptions: Array<Garment | null> =
      outerwear.length > 0 ? (wantsOuter ? [...outerwear, null] : [null, ...outerwear]) : [null];
    // A single optional accessory adds variety without exploding the search.
    const accessoryOptions: Array<Garment | null> =
      accessories.length > 0 ? [null, ...accessories.slice(0, 2)] : [null];

    const compose = (...parts: Array<Garment | null>): Garment[] =>
      parts.filter((g): g is Garment => g !== null);

    // Top + bottom based outfits.
    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoe of shoeOptions) {
          for (const outer of outerOptions) {
            for (const accessory of accessoryOptions) {
              push(compose(top, bottom, shoe, outer, accessory));
              if (candidates.length >= cap) {
                return candidates;
              }
            }
          }
        }
      }
    }

    // Dress / jumpsuit based outfits (no separate top or bottom).
    for (const dress of dresses) {
      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          for (const accessory of accessoryOptions) {
            push(compose(dress, shoe, outer, accessory));
            if (candidates.length >= cap) {
              return candidates;
            }
          }
        }
      }
    }

    return candidates;
  }
}
