/** Test fixtures: plain renderable garments/outfits used across the suite. */
import { type RenderableGarment, type RenderableOutfit } from '../abstraction/types';

export const makeGarment = (
  overrides: Partial<RenderableGarment> & Pick<RenderableGarment, 'id'>,
): RenderableGarment => ({
  name: 'Test garment',
  category: 'tops',
  subcategory: 't-shirt',
  colorHex: '#3366cc',
  ...overrides,
});

export const shirt = makeGarment({
  id: 'g-shirt',
  name: 'Camisa azul',
  category: 'tops',
  subcategory: 'shirt',
  colorHex: '#2e5cb8',
});

export const jeans = makeGarment({
  id: 'g-jeans',
  name: 'Vaqueros',
  category: 'bottoms',
  subcategory: 'jeans',
  colorHex: '#1f3a5f',
});

export const sneakers = makeGarment({
  id: 'g-sneakers',
  name: 'Zapatillas',
  category: 'shoes',
  subcategory: 'sneakers',
  colorHex: '#ffffff',
});

export const coat = makeGarment({
  id: 'g-coat',
  name: 'Abrigo',
  category: 'outerwear',
  subcategory: 'coat',
  colorHex: '#3a3a3a',
});

export const dress = makeGarment({
  id: 'g-dress',
  name: 'Vestido',
  category: 'dresses',
  subcategory: 'cocktail-dress',
  colorHex: '#7a1f3d',
});

export const heels = makeGarment({
  id: 'g-heels',
  name: 'Tacones',
  category: 'shoes',
  subcategory: 'heels',
  colorHex: '#111111',
});

export const casualOutfit: RenderableOutfit = {
  id: 'principal',
  label: 'Principal',
  garments: [shirt, jeans, sneakers, coat],
};

export const dressOutfit: RenderableOutfit = {
  id: 'mas-elegante',
  label: 'Más elegante',
  garments: [dress, heels],
};
