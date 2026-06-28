import { GarmentCategory } from './GarmentCategory';

/** Subcategories for {@link GarmentCategory.Tops}. */
export enum TopSubcategory {
  TShirt = 't-shirt',
  Shirt = 'shirt',
  Blouse = 'blouse',
  Sweater = 'sweater',
  Hoodie = 'hoodie',
  Polo = 'polo',
  TankTop = 'tank-top',
}

/** Subcategories for {@link GarmentCategory.Bottoms}. */
export enum BottomSubcategory {
  Jeans = 'jeans',
  Trousers = 'trousers',
  Shorts = 'shorts',
  Skirt = 'skirt',
  Leggings = 'leggings',
  Chinos = 'chinos',
}

/** Subcategories for {@link GarmentCategory.Dresses}. */
export enum DressSubcategory {
  Casual = 'casual-dress',
  Cocktail = 'cocktail-dress',
  Evening = 'evening-gown',
  Sundress = 'sundress',
  Jumpsuit = 'jumpsuit',
}

/** Subcategories for {@link GarmentCategory.Outerwear}. */
export enum OuterwearSubcategory {
  Jacket = 'jacket',
  Blazer = 'blazer',
  Coat = 'coat',
  ParkaHeavy = 'parka',
  Raincoat = 'raincoat',
  Cardigan = 'cardigan',
  Vest = 'vest',
}

/** Subcategories for {@link GarmentCategory.Shoes}. */
export enum ShoeSubcategory {
  Sneakers = 'sneakers',
  Boots = 'boots',
  Loafers = 'loafers',
  Heels = 'heels',
  Sandals = 'sandals',
  DressShoes = 'dress-shoes',
  Flats = 'flats',
}

/** Subcategories for {@link GarmentCategory.Accessories}. */
export enum AccessorySubcategory {
  Belt = 'belt',
  Hat = 'hat',
  Scarf = 'scarf',
  Tie = 'tie',
  Bag = 'bag',
  Watch = 'watch',
  Jewelry = 'jewelry',
  Sunglasses = 'sunglasses',
  Gloves = 'gloves',
}

/** Union of every subcategory value across all categories. */
export type GarmentSubcategory =
  | TopSubcategory
  | BottomSubcategory
  | DressSubcategory
  | OuterwearSubcategory
  | ShoeSubcategory
  | AccessorySubcategory;

/** Lookup table mapping each category to its allowed subcategory enum object. */
export const SUBCATEGORIES_BY_CATEGORY: Record<
  GarmentCategory,
  Record<string, string>
> = {
  [GarmentCategory.Tops]: TopSubcategory,
  [GarmentCategory.Bottoms]: BottomSubcategory,
  [GarmentCategory.Dresses]: DressSubcategory,
  [GarmentCategory.Outerwear]: OuterwearSubcategory,
  [GarmentCategory.Shoes]: ShoeSubcategory,
  [GarmentCategory.Accessories]: AccessorySubcategory,
};

/** Whether a subcategory legitimately belongs to the given category. */
export const isSubcategoryOf = (
  category: GarmentCategory,
  subcategory: string,
): boolean => Object.values(SUBCATEGORIES_BY_CATEGORY[category]).includes(subcategory);

/**
 * Subcategories that represent *heavy* cold-weather outerwear. The "no heavy
 * coat when it is hot" smart-rule keys off this set.
 */
export const HEAVY_OUTERWEAR: readonly string[] = [
  OuterwearSubcategory.Coat,
  OuterwearSubcategory.ParkaHeavy,
];
