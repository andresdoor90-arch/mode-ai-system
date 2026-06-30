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

/** Map a category's structural layer slot (CategoryMetadata.layerSlot) to a try-on slot. */
const LAYER_SLOT_TO_SLOT: Readonly<Record<string, SlotId>> = {
  'upper-body': 'top',
  'full-body': 'top',
  'lower-body': 'bottom',
  outer: 'outerwear',
  feet: 'shoes',
  accessory: 'accessory',
};

/** Keyword inference from a free (user-named) category/subcategory. */
const inferSlotFromText = (text: string): SlotId | null => {
  if (/cinturon|correa|belt/.test(text)) return 'belt';
  if (/zapat|tenis|zapatill|sneaker|bota|boot|mocasin|sandal|calzado|shoe/.test(text))
    return 'shoes';
  if (/chaqueta|saco|blazer|abrigo|coat|jacket|parka|cardigan|chaleco|gabardina|outer/.test(text))
    return 'outerwear';
  if (/pantalon|jean|short|falda|skirt|chino|legging|trouser|pant|bottom/.test(text))
    return 'bottom';
  if (/camis|shirt|polo|blus|sueter|sweater|hoodie|sudadera|tank|vestido|dress|top/.test(text))
    return 'top';
  if (
    /corbata|tie|gorra|hat|sombrero|reloj|watch|bufanda|scarf|bolso|bag|gafa|lente|accesori/.test(
      text,
    )
  )
    return 'accessory';
  return null;
};

/**
 * Resolve which body slot a garment occupies for the 2D try-on.
 *
 * Order of resolution: (1) the explicit `layerSlot` carried in the garment's
 * metadata from the user's category — the authoritative source for fully
 * user-defined categories; (2) the structural category slug (seed/legacy
 * garments using the fixed taxonomy); (3) keyword inference from the
 * category/subcategory text, so type-named user categories still place even if
 * no layer slot was set.
 */
export const slotForGarment = (
  garment: Pick<GarmentDTO, 'category' | 'subcategory' | 'metadata'>,
): SlotId | null => {
  const subcategory = stripDiacritics(garment.subcategory);

  // 1) Explicit layer slot from the user's category.
  const layerSlot = garment.metadata?.layerSlot;
  if (layerSlot !== undefined) {
    const mapped = LAYER_SLOT_TO_SLOT[layerSlot];
    if (mapped !== undefined) {
      return mapped === 'accessory' && /belt|cinturon|correa/.test(subcategory) ? 'belt' : mapped;
    }
  }

  // 2) Structural fixed-taxonomy slug.
  const category = stripDiacritics(garment.category);
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
      break;
  }

  // 3) Keyword inference from the (user-named) category/subcategory text.
  return inferSlotFromText(`${category} ${subcategory}`);
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
 * Build an {@link OutfitSelection} from a flat list of garments (e.g. the ones
 * the AI advisor chose for a recommended outfit). Each garment is placed in the
 * body slot it occupies; when several garments resolve to the same slot the
 * FIRST one wins (the engine returns at most one per slot, but this keeps the
 * mannequin coherent regardless). Garments with no wearable slot are skipped.
 *
 * This is the bridge that lets the advisor auto-dress the mannequin: a
 * recommendation's `garments` → a selection the Try-On already knows how to draw.
 */
export const selectionFromGarments = (garments: readonly GarmentDTO[]): OutfitSelection => {
  const selection: OutfitSelection = {};
  for (const garment of garments) {
    const slot = slotForGarment(garment);
    if (slot !== null && selection[slot] === undefined) {
      selection[slot] = garment;
    }
  }
  return selection;
};

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
