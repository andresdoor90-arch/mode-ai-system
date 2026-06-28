/**
 * Top-level garment categories.
 */
export enum GarmentCategory {
  Tops = 'tops',
  Bottoms = 'bottoms',
  Dresses = 'dresses',
  Outerwear = 'outerwear',
  Shoes = 'shoes',
  Accessories = 'accessories',
}

/**
 * A garment occupies a "layer slot" when composing an outfit. This lets the
 * domain reason about whether a set of garments forms a coherent, wearable
 * combination (e.g. you need something on the lower body unless wearing a
 * dress, and you can only wear one pair of shoes).
 */
export enum LayerSlot {
  UpperBody = 'upper-body',
  LowerBody = 'lower-body',
  FullBody = 'full-body',
  Outer = 'outer',
  Feet = 'feet',
  Accessory = 'accessory',
}

/** Map a category to the body slot it primarily occupies. */
export const categoryLayerSlot = (category: GarmentCategory): LayerSlot => {
  switch (category) {
    case GarmentCategory.Tops:
      return LayerSlot.UpperBody;
    case GarmentCategory.Bottoms:
      return LayerSlot.LowerBody;
    case GarmentCategory.Dresses:
      return LayerSlot.FullBody;
    case GarmentCategory.Outerwear:
      return LayerSlot.Outer;
    case GarmentCategory.Shoes:
      return LayerSlot.Feet;
    case GarmentCategory.Accessories:
      return LayerSlot.Accessory;
    default:
      return LayerSlot.Accessory;
  }
};
