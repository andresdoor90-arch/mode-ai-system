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

/**
 * The body region a garment occupies. Each slot is an INDEPENDENT zone of the
 * mannequin, so a full look — shirt + tie + belt + watch + pants + shoes (+ a
 * jacket or coat over the shirt) — can be worn all at once without any piece
 * displacing another. Accessories are no longer one shared bucket.
 */
export type SlotId =
  | 'fullbody'
  | 'pants'
  | 'shirt'
  | 'belt'
  | 'tie'
  | 'jacket'
  | 'coat'
  | 'shoes'
  | 'watch'
  | 'scarf'
  | 'glasses'
  | 'hat'
  | 'bag'
  | 'accessory';

/** A simplified pattern the mannequin can render. */
export type PatternId = 'solid' | 'stripes' | 'checks' | 'dots' | 'print';

/**
 * Ordered slots = the z-order layers are painted (back → front). A garment that
 * resolves to a given slot occupies ONLY that slot, so independent pieces stack
 * instead of replacing each other.
 */
export const OUTFIT_SLOTS: readonly { id: SlotId; label: string }[] = [
  { id: 'fullbody', label: 'Cuerpo completo' },
  { id: 'pants', label: 'Pantalón' },
  { id: 'shirt', label: 'Camisa / Top' },
  { id: 'belt', label: 'Correa' },
  { id: 'tie', label: 'Corbata' },
  { id: 'jacket', label: 'Chaqueta / Saco' },
  { id: 'coat', label: 'Abrigo' },
  { id: 'shoes', label: 'Calzado' },
  { id: 'scarf', label: 'Bufanda' },
  { id: 'watch', label: 'Reloj' },
  { id: 'glasses', label: 'Gafas' },
  { id: 'hat', label: 'Sombrero / Gorra' },
  { id: 'bag', label: 'Bolso' },
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

/** Map a category's structural zone (CategoryMetadata.layerSlot) to a base slot. */
const LAYER_SLOT_TO_SLOT: Readonly<Record<string, SlotId>> = {
  'upper-body': 'shirt',
  'full-body': 'fullbody',
  'lower-body': 'pants',
  outer: 'jacket',
  feet: 'shoes',
  accessory: 'accessory',
};

/** Split an accessory into a specific independent slot (belt/tie/watch/…). */
const refineAccessory = (text: string): SlotId => {
  if (/cinturon|correa|belt/.test(text)) return 'belt';
  if (/corbata|corbatin|necktie|pajarita|\btie\b/.test(text)) return 'tie';
  if (/reloj|watch|smartwatch|pulsera/.test(text)) return 'watch';
  if (/gorra|sombrero|\bhat\b|\bcap\b|beanie|boina/.test(text)) return 'hat';
  if (/gafa|lente|anteojo|sunglass|eyewear|glasses/.test(text)) return 'glasses';
  if (/bufanda|scarf|chalina|panoleta|panuelo/.test(text)) return 'scarf';
  if (/bolso|mochila|cartera|maletin|\bbag\b|backpack|tote|rinonera/.test(text)) return 'bag';
  return 'accessory';
};

/** Split outerwear into a jacket (default) or a longer coat. */
const refineOuter = (text: string): SlotId =>
  /abrigo|overcoat|gabardina|trench|parka|\bcoat\b|tapado/.test(text) ? 'coat' : 'jacket';

/** Last-resort keyword inference when neither layer slot nor taxonomy resolves. */
const inferSlotFromText = (text: string): SlotId | null => {
  const accessory = refineAccessory(text);
  if (accessory !== 'accessory') return accessory;
  if (/abrigo|chaqueta|saco|blazer|americana|cardigan|chaleco|bomber|jacket|coat/.test(text))
    return refineOuter(text);
  if (
    /zapat|tenis|zapatill|sneaker|bota|boot|mocasin|sandal|calzado|shoe|oxford|loafer|derby/.test(
      text,
    )
  )
    return 'shoes';
  if (/pantalon|jean|short|bermuda|falda|skirt|chino|legging|trouser|\bpant/.test(text))
    return 'pants';
  if (/vestido|dress|overol|jumpsuit|enterizo|peto/.test(text)) return 'fullbody';
  if (
    /camis|shirt|polo|blus|sueter|sweater|hoodie|sudadera|tank|playera|franela|jersey|\btop\b/.test(
      text,
    )
  )
    return 'shirt';
  return null;
};

/**
 * Resolve which independent body slot a garment occupies for the 2D try-on.
 *
 * Strategy: the user's STRUCTURAL zone (`metadata.layerSlot`, set when they
 * created the category) drives the primary slot; keyword refinement is used
 * only where a structural zone is too coarse — splitting `accessory` into
 * belt/tie/watch/hat/glasses/scarf/bag and `outer` into jacket/coat. This keeps
 * the user's own categorisation authoritative (a shirt stays a shirt) while
 * letting multiple accessories live in distinct slots. Falls back to the seed
 * taxonomy and then to pure keyword inference for legacy/unsorted garments.
 */
export const slotForGarment = (
  garment: Pick<GarmentDTO, 'category' | 'subcategory' | 'metadata'> & { name?: string },
): SlotId | null => {
  const text = stripDiacritics(
    [
      garment.category,
      garment.subcategory,
      garment.name ?? '',
      garment.metadata?.garmentType ?? '',
      garment.metadata?.subtype ?? '',
    ].join(' '),
  );

  // 1) Structural zone from the user's category (authoritative for the base slot).
  const layerSlot = garment.metadata?.layerSlot;
  if (layerSlot !== undefined && layerSlot in LAYER_SLOT_TO_SLOT) {
    const base = LAYER_SLOT_TO_SLOT[layerSlot];
    if (base === 'accessory') return refineAccessory(text);
    if (base === 'jacket') return refineOuter(text);
    return base ?? null;
  }

  // 2) Seed/legacy fixed taxonomy slug.
  switch (stripDiacritics(garment.category)) {
    case 'tops':
      return 'shirt';
    case 'dresses':
      return 'fullbody';
    case 'bottoms':
      return 'pants';
    case 'outerwear':
      return refineOuter(text);
    case 'shoes':
      return 'shoes';
    case 'accessories':
      return refineAccessory(text);
    default:
      break;
  }

  // 3) Pure keyword inference (user-named categories without a zone).
  return inferSlotFromText(text);
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
