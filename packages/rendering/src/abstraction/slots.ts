/**
 * Visual layering vocabulary for the avatar.
 *
 * IMPORTANT — this is a *rendering* concern, not a business rule. The domain
 * (`@mas/core`) decides whether a set of garments forms a valid outfit (its
 * `LayerSlot` governs composition validity). Here we map an already-decided
 * garment onto the avatar's body: which region it covers and in what order it
 * draws so layers stack correctly (skin → base → mid → outer → accessory).
 *
 * The slot string values intentionally mirror the domain category values so a
 * plain `GarmentCategory` string from a DTO maps over directly — but this layer
 * holds NO selection/validation logic and never calls the domain or AI.
 */

/** Where a garment sits in the visual layer stack. */
export enum GarmentLayerSlot {
  Base = 'base',
  UpperBody = 'upper-body',
  LowerBody = 'lower-body',
  FullBody = 'full-body',
  Outer = 'outer',
  Feet = 'feet',
  Accessory = 'accessory',
}

/** The region of the avatar mesh a layer is applied to. */
export enum BodyRegion {
  Head = 'head',
  Neck = 'neck',
  Torso = 'torso',
  Arms = 'arms',
  Hands = 'hands',
  Waist = 'waist',
  Legs = 'legs',
  Feet = 'feet',
  FullBody = 'full-body',
}

/**
 * Map a garment category (plain string, e.g. the domain `GarmentCategory`
 * values) to its visual slot. Unknown categories render as accessories so new
 * data never breaks the scene.
 */
export const categoryToSlot = (category: string): GarmentLayerSlot => {
  switch (category) {
    case 'tops':
      return GarmentLayerSlot.UpperBody;
    case 'bottoms':
      return GarmentLayerSlot.LowerBody;
    case 'dresses':
      return GarmentLayerSlot.FullBody;
    case 'outerwear':
      return GarmentLayerSlot.Outer;
    case 'shoes':
      return GarmentLayerSlot.Feet;
    case 'accessories':
      return GarmentLayerSlot.Accessory;
    default:
      return GarmentLayerSlot.Accessory;
  }
};

/** The primary body region covered by each slot. */
export const slotToRegion = (slot: GarmentLayerSlot): BodyRegion => {
  switch (slot) {
    case GarmentLayerSlot.Base:
      return BodyRegion.FullBody;
    case GarmentLayerSlot.UpperBody:
      return BodyRegion.Torso;
    case GarmentLayerSlot.LowerBody:
      return BodyRegion.Legs;
    case GarmentLayerSlot.FullBody:
      return BodyRegion.FullBody;
    case GarmentLayerSlot.Outer:
      return BodyRegion.Torso;
    case GarmentLayerSlot.Feet:
      return BodyRegion.Feet;
    case GarmentLayerSlot.Accessory:
      return BodyRegion.Neck;
    default:
      return BodyRegion.Torso;
  }
};

/**
 * Draw order for a slot — lower draws first (closer to the body), higher draws
 * on top. Guarantees a coat (outer) always renders over a shirt (upper body),
 * and accessories on top of everything.
 */
export const slotRenderOrder = (slot: GarmentLayerSlot): number => {
  switch (slot) {
    case GarmentLayerSlot.Base:
      return 0;
    case GarmentLayerSlot.FullBody:
      return 10;
    case GarmentLayerSlot.LowerBody:
      return 20;
    case GarmentLayerSlot.UpperBody:
      return 30;
    case GarmentLayerSlot.Feet:
      return 40;
    case GarmentLayerSlot.Outer:
      return 50;
    case GarmentLayerSlot.Accessory:
      return 60;
    default:
      return 35;
  }
};

/**
 * Slots that may hold at most ONE visible layer on the body at a time. When a
 * full-body garment (dress/jumpsuit) is present it visually supersedes separate
 * upper/lower-body layers — mirroring the domain's composition reality without
 * re-deciding it here.
 */
export const EXCLUSIVE_SLOTS: readonly GarmentLayerSlot[] = Object.freeze([
  GarmentLayerSlot.UpperBody,
  GarmentLayerSlot.LowerBody,
  GarmentLayerSlot.FullBody,
  GarmentLayerSlot.Feet,
]);
