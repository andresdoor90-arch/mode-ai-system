/**
 * Pure outfit model for the 2D paper-doll try-on.
 *
 * Maps a garment (its category/subcategory, colour, secondary colour and the
 * analysed `pattern` metadata) to a simplified visual LAYER that the SVG
 * mannequin draws — never the photograph itself, just a clean simplified
 * representation (a navy shirt, blue jeans, brown shoes, a striped/dotted top…).
 *
 * Everything here is framework-free and unit-tested so the
 * garment → layer → drawing contract is verified offline.
 */
import type { GarmentDTO } from '@shared/ipc';

/** The body region a garment occupies. */
export type SlotId = 'outerwear' | 'top' | 'bottom' | 'belt' | 'shoes' | 'accessory';

/** A simplified pattern the mannequin can render. */
export type PatternId = 'solid' | 'stripes' | 'checks' | 'dots' | 'print';

/** Ordered slots (also the z-order in which layers are painted). */
export const OUTFIT_SLOTS: readonly { id: SlotId; label: string }[] = [
  { id: 'bottom', label: 'Pantalón' },
  { id: 'top', label: 'Camisa / Top' },
  { id: 'outerwear', label: 'Chaqueta / Saco' },
  { id: 'belt', label: 'Correa' },
  { id: 'shoes', label: 'Zapatos' },
  { id: 'accessory', label: 'Accesorio' },
];

/** A simplified, drawable representation of one garment. */
export interface GarmentLayer {
  readonly garmentId: string;
  readonly slot: SlotId;
  readonly subcategory: string;
  readonly name: string;
  readonly colorHex: string;
  /** Colour used for the pattern (stripes/dots/checks). */
  readonly patternColorHex: string;
  readonly pattern: PatternId;
}

const stripDiacritics = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Map a garment's category/subcategory to the body slot it occupies. */
export const slotForGarment = (
  garment: Pick<GarmentDTO, 'category' | 'subcategory'>,
): SlotId | null => {
  const category = stripDiacritics(garment.category);
  const subcategory = stripDiacritics(garment.subcategory);
  switch (category) {
    case 'tops':
    case 'dresses':
      return 'top';
    case 'bottoms':
      return 'bottom';
    case 'outerwear':
      return 'outerwear';
    case 'shoes':
      return 'shoes';
    case 'accessories':
      return subcategory === 'belt' ? 'belt' : 'accessory';
    default:
      return null;
  }
};

/** Normalise a free-form pattern label (Spanish or English) to a PatternId. */
export const normalizePattern = (raw: string | undefined): PatternId => {
  if (raw === undefined) {
    return 'solid';
  }
  const value = stripDiacritics(raw);
  if (/(raya|stripe|listad)/.test(value)) {
    return 'stripes';
  }
  if (/(cuadro|tartan|escoces|check|plaid)/.test(value)) {
    return 'checks';
  }
  if (/(lunar|topo|punto|dot|polka)/.test(value)) {
    return 'dots';
  }
  if (/(floral|flor|estampad|print|grafic)/.test(value)) {
    return 'print';
  }
  return 'solid';
};

/** Relative luminance of a #rrggbb colour in [0, 1]. */
const luminance = (hex: string): number => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (m === null || m[1] === undefined) {
    return 0.5;
  }
  const int = Number.parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** A readable contrast colour (near-black or near-white) for a base colour. */
export const contrastColor = (hex: string): string =>
  luminance(hex) > 0.6 ? '#1b1b1f' : '#f4f4f5';

/** Build the simplified drawable layer for a garment, or null if it has no slot. */
export const garmentToLayer = (garment: GarmentDTO): GarmentLayer | null => {
  const slot = slotForGarment(garment);
  if (slot === null) {
    return null;
  }
  const colorHex = garment.color.hex;
  const pattern = normalizePattern(garment.metadata?.pattern);
  const patternColorHex =
    garment.secondaryColors[0]?.hex ?? (pattern === 'solid' ? colorHex : contrastColor(colorHex));
  return {
    garmentId: garment.id,
    slot,
    subcategory: stripDiacritics(garment.subcategory),
    name: garment.name,
    colorHex,
    patternColorHex,
    pattern,
  };
};

/** A selection of garments by slot (the outfit being assembled). */
export type OutfitSelection = Partial<Record<SlotId, GarmentDTO>>;

/**
 * Resolve a selection into ordered, drawable layers (z-order = OUTFIT_SLOTS
 * order). Garments whose slot no longer matches their own category are skipped
 * defensively.
 */
export const buildOutfitLayers = (selection: OutfitSelection): GarmentLayer[] => {
  const layers: GarmentLayer[] = [];
  for (const { id } of OUTFIT_SLOTS) {
    const garment = selection[id];
    if (garment === undefined) {
      continue;
    }
    const layer = garmentToLayer(garment);
    if (layer !== null && layer.slot === id) {
      layers.push(layer);
    }
  }
  return layers;
};
