/**
 * Deterministic, offline hex → human colour name mapping (Spanish).
 *
 * Used by the baseline vision provider to put a readable name next to the
 * extracted predominant colour. It is a nearest-neighbour lookup against a
 * small reference palette in RGB space — no network, no native deps, fully
 * deterministic. It never guesses anything beyond the colour itself.
 */

interface NamedColor {
  readonly name: string;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const PALETTE: readonly NamedColor[] = [
  { name: 'Negro', r: 0, g: 0, b: 0 },
  { name: 'Gris carbón', r: 64, g: 64, b: 64 },
  { name: 'Gris', r: 128, g: 128, b: 128 },
  { name: 'Gris claro', r: 192, g: 192, b: 192 },
  { name: 'Blanco', r: 255, g: 255, b: 255 },
  { name: 'Crema', r: 245, g: 238, b: 220 },
  { name: 'Beige', r: 214, g: 196, b: 158 },
  { name: 'Camel', r: 193, g: 154, b: 107 },
  { name: 'Marrón', r: 110, g: 70, b: 45 },
  { name: 'Chocolate', r: 71, g: 47, b: 33 },
  { name: 'Rojo', r: 200, g: 30, b: 30 },
  { name: 'Burdeos', r: 110, g: 20, b: 35 },
  { name: 'Coral', r: 240, g: 110, b: 90 },
  { name: 'Naranja', r: 235, g: 140, b: 40 },
  { name: 'Mostaza', r: 205, g: 170, b: 60 },
  { name: 'Amarillo', r: 240, g: 215, b: 70 },
  { name: 'Verde oliva', r: 110, g: 115, b: 60 },
  { name: 'Verde', r: 60, g: 150, b: 70 },
  { name: 'Verde bosque', r: 30, g: 80, b: 50 },
  { name: 'Turquesa', r: 60, g: 175, b: 170 },
  { name: 'Azul petróleo', r: 35, g: 90, b: 110 },
  { name: 'Celeste', r: 130, g: 185, b: 225 },
  { name: 'Azul', r: 40, g: 90, b: 190 },
  { name: 'Azul marino', r: 25, g: 40, b: 80 },
  { name: 'Morado', r: 110, g: 60, b: 150 },
  { name: 'Lila', r: 180, g: 150, b: 210 },
  { name: 'Rosa', r: 230, g: 130, b: 170 },
];

/** Parse a #rrggbb string into RGB; returns null when malformed. */
const parseHex = (hex: string): { r: number; g: number; b: number } | null => {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (m === null || m[1] === undefined) {
    return null;
  }
  const int = Number.parseInt(m[1], 16);
  return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff };
};

/**
 * Nearest named colour for a hex string. Returns null only when the input is
 * not a valid hex colour (so callers never invent a name from nothing).
 */
export const nameForHex = (hex: string): string | null => {
  const rgb = parseHex(hex);
  if (rgb === null) {
    return null;
  }
  let best: NamedColor | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of PALETTE) {
    // Perceptual-ish weighting (eyes are more sensitive to green).
    const dr = (rgb.r - c.r) * 0.3;
    const dg = (rgb.g - c.g) * 0.59;
    const db = (rgb.b - c.b) * 0.11;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best?.name ?? null;
};
