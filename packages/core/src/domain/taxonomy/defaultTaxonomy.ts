/**
 * Default wardrobe taxonomy — SEED DATA, not a hardcoded system taxonomy.
 *
 * Phase 6.5 removes hardcoded categories: the user owns the taxonomy as
 * editable {@link Category} data. To keep the app useful out of the box (and to
 * keep every Phase 2–6 scoring/rendering behaviour working unchanged), we seed
 * the previous built-in taxonomy as ordinary, user-editable categories. Nothing
 * here is special once it lands in the repository — the user may rename,
 * regroup, reorder, extend or delete any of it.
 *
 * The legacy `GarmentCategory` / `*Subcategory` enums and the formality map
 * survive ONLY as the source of these defaults and as a backwards-compatible
 * fallback for garments created without explicit category metadata.
 */
import { type CategoryId } from '../../shared/Identifier';
import { type IdGenerator } from '../../shared/IdGenerator';
import { unwrap } from '../../shared/Result';
import { Category } from '../entities/Category';
import { type CategoryMetadataInput } from '../value-objects/CategoryMetadata';
import { GarmentCategory, categoryLayerSlot } from '../value-objects/GarmentCategory';
import { SUBCATEGORIES_BY_CATEGORY, HEAVY_OUTERWEAR } from '../value-objects/GarmentSubcategory';
import { garmentFormality } from '../services/formality';

/**
 * Default comfort/mobility rating (0–1) per subcategory. Moved here (from the
 * scoring service) so it is part of the seed taxonomy; a garment falls back to
 * this when its category carries no explicit comfort metadata.
 */
export const DEFAULT_COMFORT_BY_SUBCATEGORY: Readonly<Record<string, number>> = {
  sneakers: 1,
  sandals: 0.9,
  flats: 0.8,
  loafers: 0.7,
  boots: 0.6,
  'dress-shoes': 0.5,
  heels: 0.2,
  't-shirt': 1,
  'tank-top': 1,
  hoodie: 1,
  sweater: 0.9,
  polo: 0.8,
  shirt: 0.6,
  blouse: 0.6,
  leggings: 1,
  shorts: 1,
  jeans: 0.7,
  chinos: 0.8,
  trousers: 0.7,
  skirt: 0.7,
  sundress: 0.9,
  'casual-dress': 0.8,
  jumpsuit: 0.6,
  'cocktail-dress': 0.5,
  'evening-gown': 0.3,
  cardigan: 0.9,
  vest: 0.8,
  jacket: 0.7,
  raincoat: 0.7,
  coat: 0.6,
  parka: 0.6,
  blazer: 0.5,
  tie: 0.3,
};

/** Default comfort for a subcategory; unknown items default to 0.8. */
export const defaultComfort = (subcategory: string): number =>
  DEFAULT_COMFORT_BY_SUBCATEGORY[subcategory] ?? 0.8;

/** Whether a subcategory is heavy cold-weather outerwear by default. */
export const isDefaultHeavyOuterwear = (subcategory: string): boolean =>
  HEAVY_OUTERWEAR.includes(subcategory);

/**
 * Resolve the default {@link CategoryMetadataInput} for a (category, subcategory)
 * pair from the legacy maps. This is the backwards-compatible fallback used when
 * a garment is created without explicit category metadata.
 */
export const defaultCategoryMetadata = (
  category: string,
  subcategory?: string,
): CategoryMetadataInput => {
  const slot = categoryLayerSlot(category as GarmentCategory);
  const key = subcategory ?? '';
  return {
    layerSlot: slot,
    formality: subcategory !== undefined ? garmentFormality(subcategory) : 5,
    comfort: defaultComfort(key),
    heavyOuterwear: isDefaultHeavyOuterwear(key),
  };
};

/** Human-friendly display names for the seeded top-level categories. */
const CATEGORY_LABEL: Readonly<Record<GarmentCategory, string>> = {
  [GarmentCategory.Tops]: 'Tops',
  [GarmentCategory.Bottoms]: 'Bottoms',
  [GarmentCategory.Dresses]: 'Dresses',
  [GarmentCategory.Outerwear]: 'Outerwear',
  [GarmentCategory.Shoes]: 'Shoes',
  [GarmentCategory.Accessories]: 'Accessories',
};

/** A coarse grouping used purely for default UI organisation. */
const CATEGORY_GROUP: Readonly<Record<GarmentCategory, string>> = {
  [GarmentCategory.Tops]: 'Apparel',
  [GarmentCategory.Bottoms]: 'Apparel',
  [GarmentCategory.Dresses]: 'Apparel',
  [GarmentCategory.Outerwear]: 'Apparel',
  [GarmentCategory.Shoes]: 'Footwear',
  [GarmentCategory.Accessories]: 'Accessories',
};

/** Turn a kebab/enum slug into a Title Case label for subcategory display. */
const labelFromSlug = (slug: string): string =>
  slug
    .split('-')
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');

/**
 * Build the default taxonomy as user-editable {@link Category} data: each
 * legacy top-level category plus its subcategories, each carrying the metadata
 * (layer slot / formality / comfort / heavy-outerwear) the rest of the system
 * needs. Ids are produced by the injected {@link IdGenerator} so the migration
 * is deterministic in tests and UUID-backed in production.
 */
export const buildDefaultTaxonomy = (ids: IdGenerator): readonly Category[] => {
  const categories: Category[] = [];
  let order = 0;

  for (const cat of Object.values(GarmentCategory)) {
    const parentId = ids.next<'Category'>();
    const slot = categoryLayerSlot(cat);
    categories.push(
      unwrap(
        Category.create(parentId, {
          name: CATEGORY_LABEL[cat],
          slug: cat,
          parentId: null,
          group: CATEGORY_GROUP[cat],
          order: order++,
          seeded: true,
          metadata: {
            layerSlot: slot,
            // A parent category's formality is a neutral midpoint; subcategories
            // refine it. Heavy-outerwear is decided per subcategory.
            formality: 5,
            comfort: 0.8,
            heavyOuterwear: false,
          },
        }),
      ),
    );

    let childOrder = 0;
    const subSlugs = Object.values(SUBCATEGORIES_BY_CATEGORY[cat]);
    for (const sub of subSlugs) {
      categories.push(
        unwrap(
          Category.create(ids.next<'Category'>(), {
            name: labelFromSlug(sub),
            slug: sub,
            parentId,
            group: CATEGORY_GROUP[cat],
            order: childOrder++,
            seeded: true,
            metadata: {
              layerSlot: slot,
              formality: garmentFormality(sub),
              comfort: defaultComfort(sub),
              heavyOuterwear: isDefaultHeavyOuterwear(sub),
            },
          }),
        ),
      );
    }
  }

  return categories;
};

/** Resolve the seeded parent id of a top-level category slug, for convenience. */
export const findSeededRootBySlug = (
  categories: readonly Category[],
  slug: string,
): CategoryId | null => categories.find((c) => c.slug === slug && c.parentId === null)?.id ?? null;
