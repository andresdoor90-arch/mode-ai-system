/**
 * Formality scale (0 = beachwear, 10 = black-tie) keyed by garment subcategory.
 *
 * Centralised here so the compatibility, occasion-matching and scoring services
 * all reason about formality consistently. Unknown subcategories default to a
 * neutral mid-point of 5.
 */
const FORMALITY_BY_SUBCATEGORY: Readonly<Record<string, number>> = {
  // Tops
  'tank-top': 1,
  't-shirt': 2,
  hoodie: 2,
  polo: 4,
  sweater: 5,
  shirt: 6,
  blouse: 6,
  // Bottoms
  shorts: 2,
  leggings: 2,
  jeans: 3,
  chinos: 5,
  skirt: 5,
  trousers: 7,
  // Dresses
  sundress: 3,
  'casual-dress': 4,
  jumpsuit: 6,
  'cocktail-dress': 8,
  'evening-gown': 10,
  // Outerwear
  parka: 4,
  raincoat: 4,
  cardigan: 5,
  jacket: 5,
  vest: 6,
  coat: 6,
  blazer: 8,
  // Shoes
  sandals: 1,
  sneakers: 2,
  flats: 5,
  boots: 5,
  loafers: 6,
  heels: 8,
  'dress-shoes': 9,
  // Accessories
  sunglasses: 4,
  hat: 4,
  gloves: 4,
  belt: 5,
  scarf: 5,
  bag: 5,
  watch: 6,
  jewelry: 6,
  tie: 9,
};

/** Default formality when a subcategory is not explicitly mapped. */
export const NEUTRAL_FORMALITY = 5;

/** Formality (0–10) for a garment subcategory. */
export const garmentFormality = (subcategory: string): number =>
  FORMALITY_BY_SUBCATEGORY[subcategory] ?? NEUTRAL_FORMALITY;
