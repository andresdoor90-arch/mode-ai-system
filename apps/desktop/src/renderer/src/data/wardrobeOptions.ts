/**
 * Wardrobe option vocabularies (renderer-local).
 *
 * These mirror the string values of the domain enums in `@mas/core`, but are
 * declared here as plain data so the renderer stays fully decoupled from the
 * domain/infrastructure packages — only DTOs and primitive strings ever cross
 * the IPC boundary. The main process validates these values against the real
 * domain enums when a command is dispatched, so an invalid combination is
 * rejected with a structured error rather than silently accepted.
 */
export interface Option {
  readonly value: string;
  readonly label: string;
}

export const CATEGORY_OPTIONS: readonly Option[] = [
  { value: 'tops', label: 'Tops' },
  { value: 'bottoms', label: 'Bottoms' },
  { value: 'dresses', label: 'Dresses' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessories', label: 'Accessories' },
];

export const SUBCATEGORY_OPTIONS: Record<string, readonly Option[]> = {
  tops: [
    { value: 't-shirt', label: 'T-shirt' },
    { value: 'shirt', label: 'Shirt' },
    { value: 'blouse', label: 'Blouse' },
    { value: 'sweater', label: 'Sweater' },
    { value: 'hoodie', label: 'Hoodie' },
    { value: 'polo', label: 'Polo' },
    { value: 'tank-top', label: 'Tank top' },
  ],
  bottoms: [
    { value: 'jeans', label: 'Jeans' },
    { value: 'trousers', label: 'Trousers' },
    { value: 'shorts', label: 'Shorts' },
    { value: 'skirt', label: 'Skirt' },
    { value: 'leggings', label: 'Leggings' },
    { value: 'chinos', label: 'Chinos' },
  ],
  dresses: [
    { value: 'casual-dress', label: 'Casual dress' },
    { value: 'cocktail-dress', label: 'Cocktail dress' },
    { value: 'evening-gown', label: 'Evening gown' },
    { value: 'sundress', label: 'Sundress' },
    { value: 'jumpsuit', label: 'Jumpsuit' },
  ],
  outerwear: [
    { value: 'jacket', label: 'Jacket' },
    { value: 'blazer', label: 'Blazer' },
    { value: 'coat', label: 'Coat' },
    { value: 'parka', label: 'Parka' },
    { value: 'raincoat', label: 'Raincoat' },
    { value: 'cardigan', label: 'Cardigan' },
    { value: 'vest', label: 'Vest' },
  ],
  shoes: [
    { value: 'sneakers', label: 'Sneakers' },
    { value: 'boots', label: 'Boots' },
    { value: 'loafers', label: 'Loafers' },
    { value: 'heels', label: 'Heels' },
    { value: 'sandals', label: 'Sandals' },
    { value: 'dress-shoes', label: 'Dress shoes' },
    { value: 'flats', label: 'Flats' },
  ],
  accessories: [
    { value: 'belt', label: 'Belt' },
    { value: 'hat', label: 'Hat' },
    { value: 'scarf', label: 'Scarf' },
    { value: 'tie', label: 'Tie' },
    { value: 'bag', label: 'Bag' },
    { value: 'watch', label: 'Watch' },
    { value: 'jewelry', label: 'Jewelry' },
    { value: 'sunglasses', label: 'Sunglasses' },
    { value: 'gloves', label: 'Gloves' },
  ],
};

export const SEASON_OPTIONS: readonly Option[] = [
  { value: 'all-season', label: 'All season' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' },
];

export const OCCASION_OPTIONS: readonly Option[] = [
  { value: 'casual', label: 'Casual' },
  { value: 'business', label: 'Business' },
  { value: 'formal', label: 'Formal' },
  { value: 'sport', label: 'Sport' },
  { value: 'party', label: 'Party' },
  { value: 'date', label: 'Date' },
  { value: 'travel', label: 'Travel' },
  { value: 'home', label: 'Home' },
];

export const STATUS_OPTIONS: readonly Option[] = [
  { value: 'available', label: 'Available' },
  { value: 'in-laundry', label: 'In laundry' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'archived', label: 'Archived' },
];
