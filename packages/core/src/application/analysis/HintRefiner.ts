import { type AnalyzedField, type GarmentAnalysis } from './visionPorts';

/**
 * Turns the user's free-text Spanish notes into structured, high-confidence
 * corrections.
 *
 * The product gives the user a single "help improve the analysis" box instead
 * of dozens of form fields. Whatever they type ("es de lino", "manga larga",
 * "azul petróleo", "la uso para la iglesia", "cuello mao", "es oversize") is
 * parsed here into {@link GarmentAnalysis} fields tagged with source `'user'`,
 * so the merge step lets them override the vision model and colour baseline.
 *
 * It is deterministic, dictionary-driven and offline. It only emits a field
 * when the text contains an unambiguous cue for it — it never guesses.
 */

/** Lower-case and strip diacritics so matching is accent-insensitive. */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type Dict = ReadonlyArray<readonly [patterns: readonly string[], value: string]>;

const COLORS: ReadonlyArray<readonly [patterns: readonly string[], hex: string, name: string]> = [
  [['azul marino', 'azul oscuro', 'marino'], '#19284f', 'Azul marino'],
  [['azul petroleo', 'petroleo'], '#235a6e', 'Azul petróleo'],
  [['azul cielo', 'celeste', 'azul claro'], '#82b9e1', 'Celeste'],
  [['turquesa'], '#3cafaa', 'Turquesa'],
  [['azul'], '#285abe', 'Azul'],
  [['verde oliva', 'oliva'], '#6e733c', 'Verde oliva'],
  [['verde bosque', 'verde oscuro'], '#1e5032', 'Verde bosque'],
  [['verde'], '#3c9646', 'Verde'],
  [['burdeos', 'vino', 'granate'], '#6e1423', 'Burdeos'],
  [['rojo'], '#c81e1e', 'Rojo'],
  [['coral', 'salmon'], '#f06e5a', 'Coral'],
  [['naranja'], '#eb8c28', 'Naranja'],
  [['mostaza'], '#cdaa3c', 'Mostaza'],
  [['amarillo'], '#f0d746', 'Amarillo'],
  [['morado', 'purpura', 'violeta', 'lila'], '#6e3c96', 'Morado'],
  [['rosa', 'rosado'], '#e682aa', 'Rosa'],
  [['marron', 'cafe', 'chocolate'], '#6e462d', 'Marrón'],
  [['camel'], '#c19a6b', 'Camel'],
  [['beige', 'arena'], '#d6c49e', 'Beige'],
  [['crema', 'hueso', 'marfil'], '#f5eedc', 'Crema'],
  [['blanco'], '#ffffff', 'Blanco'],
  [['gris claro'], '#c0c0c0', 'Gris claro'],
  [['gris'], '#808080', 'Gris'],
  [['negro'], '#000000', 'Negro'],
];

const GARMENT_TYPES: ReadonlyArray<
  readonly [patterns: readonly string[], type: string, category: string, subcategory: string]
> = [
  [['camiseta', 'playera', 'remera'], 'Camiseta', 'tops', 't-shirt'],
  [['camisa'], 'Camisa', 'tops', 'shirt'],
  [['blusa'], 'Blusa', 'tops', 'blouse'],
  [['polo'], 'Polo', 'tops', 'polo'],
  [['sueter', 'jersey', 'sweater'], 'Suéter', 'tops', 'sweater'],
  [['sudadera', 'hoodie', 'buzo'], 'Sudadera', 'tops', 'hoodie'],
  [['vaqueros', 'jeans', 'mezclilla'], 'Jeans', 'bottoms', 'jeans'],
  [['chinos', 'chino'], 'Chinos', 'bottoms', 'chinos'],
  [['short', 'bermuda', 'bermudas'], 'Short', 'bottoms', 'shorts'],
  [['pantalon'], 'Pantalón', 'bottoms', 'trousers'],
  [['falda'], 'Falda', 'bottoms', 'skirt'],
  [['blazer', 'americana', 'saco'], 'Blazer', 'outerwear', 'blazer'],
  [['abrigo'], 'Abrigo', 'outerwear', 'coat'],
  [['parka'], 'Parka', 'outerwear', 'parka'],
  [['gabardina', 'impermeable'], 'Gabardina', 'outerwear', 'raincoat'],
  [['cardigan', 'rebeca'], 'Cárdigan', 'outerwear', 'cardigan'],
  [['chaleco'], 'Chaleco', 'outerwear', 'vest'],
  [['chaqueta', 'cazadora'], 'Chaqueta', 'outerwear', 'jacket'],
  [['tenis', 'zapatillas', 'deportivas', 'sneakers'], 'Zapatillas', 'shoes', 'sneakers'],
  [['botas', 'botines'], 'Botas', 'shoes', 'boots'],
  [['mocasines'], 'Mocasines', 'shoes', 'loafers'],
  [['sandalias'], 'Sandalias', 'shoes', 'sandals'],
  [['zapatos'], 'Zapatos', 'shoes', 'dress-shoes'],
  [['corbata'], 'Corbata', 'accessories', 'tie'],
  [['cinturon', 'correa'], 'Cinturón', 'accessories', 'belt'],
  [['gorra', 'sombrero', 'gorro'], 'Gorra', 'accessories', 'hat'],
  [['bufanda'], 'Bufanda', 'accessories', 'scarf'],
  [['reloj'], 'Reloj', 'accessories', 'watch'],
  [['bolso', 'mochila', 'bolsa'], 'Bolso', 'accessories', 'bag'],
  [['gafas', 'lentes'], 'Gafas', 'accessories', 'sunglasses'],
];

const MATERIALS: Dict = [
  [['lino'], 'Lino'],
  [['algodon'], 'Algodón'],
  [['lana'], 'Lana'],
  [['seda'], 'Seda'],
  [['poliester'], 'Poliéster'],
  [['denim', 'mezclilla'], 'Denim'],
  [['cuero', 'piel'], 'Cuero'],
  [['gamuza', 'ante'], 'Gamuza'],
  [['pana'], 'Pana'],
  [['nylon', 'nailon'], 'Nylon'],
  [['cachemir', 'cachemira'], 'Cachemira'],
];

const SLEEVES: Dict = [
  [['manga larga', 'mangas largas'], 'Manga larga'],
  [['manga corta', 'mangas cortas'], 'Manga corta'],
  [['sin mangas', 'sin manga', 'tirantes'], 'Sin mangas'],
  [['manga tres cuartos', 'tres cuartos'], 'Manga 3/4'],
];

const NECKLINES: Dict = [
  [['cuello mao', 'mao'], 'Cuello mao'],
  [['cuello en v', 'en v', 'pico'], 'Cuello en V'],
  [['cuello redondo', 'cuello redondo'], 'Cuello redondo'],
  [['cuello alto', 'tortuga', 'cisne'], 'Cuello alto'],
  [['cuello camisero', 'cuello de camisa'], 'Cuello camisero'],
  [['cuello polo'], 'Cuello polo'],
  [['cuello barco'], 'Cuello barco'],
];

const FITS: Dict = [
  [['oversize', 'holgad', 'suelt', 'amplio', 'ancho'], 'Oversize'],
  [['entallad', 'ajustad', 'slim', 'cenid', 'pegad'], 'Entallado'],
  [['regular', 'recto'], 'Regular'],
];

const PATTERNS: Dict = [
  [['a rayas', 'rayas', 'rayado'], 'Rayas'],
  [['a cuadros', 'cuadros', 'cuadrille'], 'Cuadros'],
  [['tartan', 'escoces'], 'Tartán'],
  [['lunares', 'topos'], 'Lunares'],
  [['floral', 'flores'], 'Floral'],
  [['estampad'], 'Estampado'],
  [['liso', 'lisa', 'unicolor'], 'Liso'],
];

const LENGTHS: Dict = [
  [['crop', 'cropped'], 'Crop'],
  [['midi'], 'Midi'],
  [['largo', 'larga'], 'Largo'],
  [['corto', 'corta'], 'Corto'],
];

const TEXTURES: Dict = [
  [['tejido de punto', 'de punto', 'punto'], 'Punto'],
  [['brillante', 'satinad'], 'Brillante'],
  [['mate'], 'Mate'],
  [['rugos', 'aspero'], 'Rugoso'],
  [['suave', 'sedos'], 'Suave'],
];

const STYLES: Dict = [
  [['elegante', 'sofisticad'], 'Elegante'],
  [['formal'], 'Formal'],
  [['casual', 'informal'], 'Casual'],
  [['deportiv', 'sport'], 'Deportivo'],
  [['clasic'], 'Clásico'],
  [['moderno', 'contemporaneo'], 'Moderno'],
  [['vintage', 'retro'], 'Vintage'],
  [['minimalista'], 'Minimalista'],
];

const SEASONS: Dict = [
  [['todo el ano', 'todas las estaciones', 'todo el año'], 'all-season'],
  [['verano'], 'summer'],
  [['invierno'], 'winter'],
  [['primavera'], 'spring'],
  [['otono'], 'autumn'],
];

const GENDERS: Dict = [
  [['unisex'], 'unisex'],
  [['hombre', 'masculino', 'caballero', 'para el'], 'male'],
  [['mujer', 'femenino', 'dama', 'para ella'], 'female'],
];

/** Occasion cues → occasion slug + the formality (0–10) it implies. */
const OCCASIONS: ReadonlyArray<
  readonly [patterns: readonly string[], occasion: string, formality: number]
> = [
  [
    ['iglesia', 'misa', 'boda', 'gala', 'ceremonia', 'evento elegante', 'eventos elegantes'],
    'formal',
    9,
  ],
  [['trabajo', 'oficina', 'negocios', 'reunion', 'reuniones'], 'business', 7],
  [['fiesta', 'fiestas', 'discoteca'], 'party', 6],
  [['cita', 'romantic'], 'date', 6],
  [['deporte', 'gimnasio', 'gym', 'correr', 'entrenar'], 'sport', 1],
  [['viaje', 'viajar', 'viajes'], 'travel', 3],
  [['casa', 'hogar'], 'home', 1],
  [['diario', 'dia a dia', 'todos los dias', 'casual'], 'casual', 3],
];

const field = <T>(value: T, confidence: number): AnalyzedField<T> => ({
  value,
  confidence,
  source: 'user',
});

const firstMatch = (text: string, dict: Dict): string | null => {
  for (const [patterns, value] of dict) {
    if (patterns.some((p) => text.includes(p))) {
      return value;
    }
  }
  return null;
};

export class HintRefiner {
  /** Parse free-text notes into a partial, user-sourced analysis. */
  public refine(freeText: string): GarmentAnalysis {
    const text = normalize(freeText);
    if (text.trim().length === 0) {
      return {};
    }
    const out: Record<string, AnalyzedField<unknown>> = {};
    const tags: string[] = [];

    // Garment type → also sets category/subcategory.
    for (const [patterns, type, category, subcategory] of GARMENT_TYPES) {
      if (patterns.some((p) => text.includes(p))) {
        out['garmentType'] = field(type, 0.95);
        out['category'] = field(category, 0.9);
        out['subcategory'] = field(subcategory, 0.9);
        break;
      }
    }

    // Colour → primary hex + readable name.
    for (const [patterns, hex, name] of COLORS) {
      if (patterns.some((p) => text.includes(p))) {
        out['primaryColor'] = field(hex, 0.9);
        out['primaryColorName'] = field(name, 0.9);
        tags.push(name);
        break;
      }
    }

    const material = firstMatch(text, MATERIALS);
    if (material !== null) {
      out['material'] = field(material, 0.95);
      tags.push(material);
    }

    const sleeve = firstMatch(text, SLEEVES);
    if (sleeve !== null) {
      out['sleeve'] = field(sleeve, 0.95);
    }

    const neckline = firstMatch(text, NECKLINES);
    if (neckline !== null) {
      out['neckline'] = field(neckline, 0.95);
    }

    const fit = firstMatch(text, FITS);
    if (fit !== null) {
      out['fit'] = field(fit, 0.9);
    }

    const pattern = firstMatch(text, PATTERNS);
    if (pattern !== null) {
      out['pattern'] = field(pattern, 0.9);
    }

    const length = firstMatch(text, LENGTHS);
    if (length !== null) {
      out['length'] = field(length, 0.85);
    }

    const texture = firstMatch(text, TEXTURES);
    if (texture !== null) {
      out['texture'] = field(texture, 0.85);
    }

    const style = firstMatch(text, STYLES);
    if (style !== null) {
      out['style'] = field(style, 0.9);
      tags.push(style);
    }

    const season = firstMatch(text, SEASONS);
    if (season !== null) {
      out['season'] = field(season, 0.9);
    }

    const gender = firstMatch(text, GENDERS);
    if (gender !== null) {
      out['gender'] = field(gender, 0.9);
    }

    // Occasions can be multiple; collect every distinct match.
    const occasions: string[] = [];
    let formalityCue: number | null = null;
    for (const [patterns, occasion, formality] of OCCASIONS) {
      if (patterns.some((p) => text.includes(p))) {
        if (!occasions.includes(occasion)) {
          occasions.push(occasion);
          tags.push(occasion);
        }
        formalityCue = formalityCue === null ? formality : Math.max(formalityCue, formality);
      }
    }
    if (occasions.length > 0) {
      out['occasions'] = field(occasions as readonly string[], 0.9);
    }
    if (formalityCue !== null) {
      out['formality'] = field(formalityCue, 0.85);
    }

    if (tags.length > 0) {
      out['suggestedTags'] = field([...new Set(tags)] as readonly string[], 0.85);
    }

    return out as GarmentAnalysis;
  }
}
