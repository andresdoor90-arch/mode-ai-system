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

const norm = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Classify an accessory by the INDEPENDENT body zone it occupies, so a belt, a
 * tie and a watch can all be added to the same outfit (they no longer compete
 * for a single "accessory" slot). Mirrors the try-on slot split.
 */
const accessoryKind = (g: Garment): string => {
  const text = norm(
    `${g.category} ${g.subcategory} ${g.name} ${g.metadata['garmentType'] ?? ''} ${g.metadata['subtype'] ?? ''}`,
  );
  if (/cinturon|correa|belt/.test(text)) return 'belt';
  if (/corbata|corbatin|necktie|pajarita|tie/.test(text)) return 'tie';
  if (/reloj|watch|smartwatch/.test(text)) return 'watch';
  if (/gorra|sombrero|hat|cap|beanie|boina/.test(text)) return 'hat';
  if (/gafa|lente|anteojo|sunglass|glasses/.test(text)) return 'glasses';
  if (/bufanda|scarf|chalina/.test(text)) return 'scarf';
  if (/bolso|mochila|cartera|maletin|bag|backpack/.test(text)) return 'bag';
  return 'other';
};

/**
 * A complementary accessory bundle: at most one accessory per distinct zone.
 * Adding these is structurally safe (each occupies its own body region) and
 * lets the advisor propose a complete look (shirt + tie + belt + watch …).
 */
const buildAccessoryBundle = (accessories: readonly Garment[]): readonly Garment[] => {
  const byKind = new Map<string, Garment>();
  for (const garment of accessories) {
    const kind = accessoryKind(garment);
    if (!byKind.has(kind)) {
      byKind.set(kind, garment);
    }
  }
  return [...byKind.values()].slice(0, 5);
};

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

    // A complementary accessory bundle (belt + tie + watch + …), one per zone.
    // Each base look is offered both with and without it, so the ranker keeps
    // the bare version for casual contexts and the complete one when it fits.
    const accessoryBundle = buildAccessoryBundle(accessories);

    const compose = (...parts: Array<Garment | null>): Garment[] =>
      parts.filter((g): g is Garment => g !== null);

    const pushWithAccessories = (base: Garment[]): void => {
      push(base);
      if (accessoryBundle.length > 0) {
        push([...base, ...accessoryBundle]);
      }
    };

    // Top + bottom based outfits.
    for (const top of tops) {
      for (const bottom of bottoms) {
        for (const shoe of shoeOptions) {
          for (const outer of outerOptions) {
            pushWithAccessories(compose(top, bottom, shoe, outer));
            if (candidates.length >= cap) {
              return candidates;
            }
          }
        }
      }
    }

    // Dress / jumpsuit based outfits (no separate top or bottom).
    for (const dress of dresses) {
      for (const shoe of shoeOptions) {
        for (const outer of outerOptions) {
          pushWithAccessories(compose(dress, shoe, outer));
          if (candidates.length >= cap) {
            return candidates;
          }
        }
      }
    }

    return candidates;
  }
}
