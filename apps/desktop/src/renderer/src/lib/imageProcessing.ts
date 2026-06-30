/**
 * Browser-side image processing for the photo-first flow.
 *
 * Decoding happens entirely in the Electron renderer (real Chromium). The
 * image is decoded with `createImageBitmap(file)`, which reads the Blob/File
 * bytes DIRECTLY through Chromium's native decoders (PNG, JPEG, WEBP, GIF,
 * AVIF). This deliberately avoids `new Image()` + `blob:`/object URLs and the
 * `<img>` element load path, which is governed by CSP `img-src` and is fragile
 * in a packaged `file://` sandboxed renderer. `createImageBitmap` is not an
 * element load and is not subject to `img-src`, so a valid image always
 * decodes regardless of CSP or origin.
 *
 * From the decoded bitmap we sample a small grid of opaque pixels (for the
 * offline colour baseline) and render an optimized thumbnail. The original
 * bytes are read once as base64 (to persist the untouched original and to show
 * a CSP-safe `data:` preview). No network, no fabrication, no fallbacks.
 */
import type { RgbSampleDTO } from '@shared/ipc';

/** The full result of preparing a picked image for analysis + persistence. */
export interface ProcessedImage {
  /** Base64 of the original bytes (no data-URL prefix). */
  readonly base64: string;
  readonly mimeType: string;
  /** Lowercase extension without the dot. */
  readonly extension: string;
  /** Sampled opaque pixels for the colour baseline. */
  readonly colorSamples: RgbSampleDTO[];
  /** Base64 of the optimized thumbnail (no prefix). */
  readonly thumbnailBase64: string;
  /** CSP-safe `data:` URL for immediate on-screen preview. */
  readonly previewDataUrl: string;
  readonly width: number;
  readonly height: number;
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const extensionFor = (file: File): string => {
  const fromName = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
    : '';
  if (fromName.length > 0) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  const fromMime = Object.entries(MIME_BY_EXT).find(([, mime]) => mime === file.type)?.[0];
  return fromMime ?? 'png';
};

const mimeFor = (file: File, extension: string): string =>
  file.type.length > 0 ? file.type : (MIME_BY_EXT[extension] ?? 'image/png');

const stripDataUrlPrefix = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
};

const readAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

/** Quantise a channel to a coarse bucket for grouping similar colours. */
const bucketChannel = (value: number, step = 32): number => Math.round(value / step) * step;

/** Squared Euclidean distance in RGB (cheap; avoids a sqrt per pixel). */
const colorDistanceSq = (
  ar: number,
  ag: number,
  ab: number,
  br: number,
  bg: number,
  bb: number,
): number => (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;

/**
 * Segment the garment out of its background and return ONLY the garment pixels.
 *
 * Real photos put the garment on some backdrop (white/black/grey/wood/desk/…).
 * Sampling every pixel would let the backdrop dominate (a brown belt on a white
 * sheet reads as "white"). So we:
 *  1. Estimate the background from the image BORDER (the frame is almost always
 *     backdrop), clustering border pixels into up to a few dominant colours.
 *  2. Keep only pixels far enough (RGB distance) from every background cluster.
 *  3. For large masks, gently erode 1px to drop anti-aliased halo pixels at the
 *     garment/background edge (the source of spurious "sky-blue" secondaries).
 *  4. Keep the result whenever it has at least a SMALL absolute number of pixels
 *     — crucially this works for SMALL objects (a thin belt) that occupy a tiny
 *     fraction of the frame. Only when essentially nothing separates from the
 *     backdrop (garment colour ≈ backdrop) do we fall back to all opaque pixels.
 * Transparent pixels (cut-out PNGs) are always skipped.
 *
 * Pure and deterministic — operates on raw RGBA so it is unit-tested without a
 * canvas. `threshold` is the Euclidean colour distance from the background.
 */
export function segmentGarmentSamples(
  rgba: Uint8ClampedArray | readonly number[],
  width: number,
  height: number,
  threshold = 64,
): RgbSampleDTO[] {
  const thresholdSq = threshold * threshold;
  const at = (i: number): number => rgba[i] ?? 0;
  const total = width * height;
  const R = new Uint8Array(total);
  const G = new Uint8Array(total);
  const B = new Uint8Array(total);
  const opaque = new Uint8Array(total);

  const marginX = Math.max(1, Math.round(width * 0.12));
  const marginY = Math.max(1, Math.round(height * 0.12));
  const borderBuckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let opaqueCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = y * width + x;
      if (at(px * 4 + 3) < 128) {
        continue; // skip transparent pixels (cut-out backgrounds)
      }
      const r = at(px * 4);
      const g = at(px * 4 + 1);
      const b = at(px * 4 + 2);
      R[px] = r;
      G[px] = g;
      B[px] = b;
      opaque[px] = 1;
      opaqueCount += 1;
      if (x < marginX || x >= width - marginX || y < marginY || y >= height - marginY) {
        const key = `${bucketChannel(r)},${bucketChannel(g)},${bucketChannel(b)}`;
        const acc = borderBuckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
        acc.r += r;
        acc.g += g;
        acc.b += b;
        acc.n += 1;
        borderBuckets.set(key, acc);
      }
    }
  }

  const collect = (mask: Uint8Array): RgbSampleDTO[] => {
    const out: RgbSampleDTO[] = [];
    for (let px = 0; px < total; px += 1) {
      if (mask[px] === 1) {
        out.push({ r: R[px] ?? 0, g: G[px] ?? 0, b: B[px] ?? 0, weight: 1 });
      }
    }
    return out;
  };

  if (opaqueCount === 0) {
    return [];
  }

  // Dominant background colours = the most populated border buckets that each
  // cover a meaningful share of the border (keeps multi-tone backdrops sane).
  const sortedBorder = [...borderBuckets.values()].sort((a, b) => b.n - a.n);
  const borderTotal = sortedBorder.reduce((sum, c) => sum + c.n, 0);
  const background = sortedBorder
    .filter((c) => c.n / Math.max(1, borderTotal) >= 0.08)
    .slice(0, 3)
    .map((c) => ({ r: c.r / c.n, g: c.g / c.n, b: c.b / c.n }));

  if (background.length === 0) {
    return collect(opaque);
  }

  const mask = new Uint8Array(total);
  let fgCount = 0;
  for (let px = 0; px < total; px += 1) {
    if (
      opaque[px] === 1 &&
      background.every(
        (bg) => colorDistanceSq(R[px] ?? 0, G[px] ?? 0, B[px] ?? 0, bg.r, bg.g, bg.b) > thresholdSq,
      )
    ) {
      mask[px] = 1;
      fgCount += 1;
    }
  }

  // Gentle 1px erosion for large masks only: removes anti-aliased halo pixels
  // at the garment/background boundary without harming small/thin objects.
  let useMask = mask;
  if (fgCount >= 400) {
    const eroded = new Uint8Array(total);
    let erodedCount = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const px = y * width + x;
        if (mask[px] !== 1) {
          continue;
        }
        let neighbours = 0;
        if (x > 0 && mask[px - 1] === 1) neighbours += 1;
        if (x < width - 1 && mask[px + 1] === 1) neighbours += 1;
        if (y > 0 && mask[px - width] === 1) neighbours += 1;
        if (y < height - 1 && mask[px + width] === 1) neighbours += 1;
        if (neighbours >= 2) {
          eroded[px] = 1;
          erodedCount += 1;
        }
      }
    }
    if (erodedCount >= fgCount * 0.5) {
      useMask = eroded;
      fgCount = erodedCount;
    }
  }

  // A small absolute floor: enough pixels for a stable colour, yet low enough to
  // keep a SMALL object (belt/watch). Below it, garment ≈ backdrop → use all.
  const MIN_FOREGROUND = 6;
  return fgCount >= MIN_FOREGROUND ? collect(useMask) : collect(opaque);
}

/** Sample a downscaled grid and keep only garment (non-background) pixels. */
function sampleColors(bitmap: ImageBitmap, grid = 72): RgbSampleDTO[] {
  const canvas = document.createElement('canvas');
  const w = (canvas.width = Math.max(1, Math.min(grid, bitmap.width || grid)));
  const h = (canvas.height = Math.max(1, Math.min(grid, bitmap.height || grid)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) {
    return [];
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  return segmentGarmentSamples(data, w, h);
}

/** Render an optimized thumbnail (WebP, falling back to JPEG) from the bitmap. */
function makeThumbnail(bitmap: ImageBitmap, maxDim = 512, quality = 0.82): string {
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width || maxDim, bitmap.height || maxDim));
  const w = Math.max(1, Math.round((bitmap.width || maxDim) * ratio));
  const h = Math.max(1, Math.round((bitmap.height || maxDim) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return '';
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return stripDataUrlPrefix(dataUrl);
}

/**
 * Prepare a picked image file: decode it, sample colours and build a thumbnail.
 * Throws a clear error only if the bytes are genuinely not a decodable image.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  const extension = extensionFor(file);
  const mimeType = mimeFor(file, extension);

  // Diagnostic trace of exactly what the renderer received.
  // eslint-disable-next-line no-console
  console.info('[addGarment] processing image', {
    name: file.name,
    type: file.type,
    size: file.size,
    extension,
    mimeType,
  });

  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este entorno no soporta la decodificación de imágenes.');
  }

  const base64 = stripDataUrlPrefix(await readAsDataUrl(file));

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (cause) {
    // eslint-disable-next-line no-console
    console.error('[addGarment] createImageBitmap failed', {
      name: file.name,
      type: file.type,
      size: file.size,
      cause,
    });
    throw new Error('No se pudo decodificar la imagen seleccionada.');
  }

  try {
    // eslint-disable-next-line no-console
    console.info('[addGarment] decoded bitmap', { width: bitmap.width, height: bitmap.height });
    const colorSamples = sampleColors(bitmap);
    const thumbnailBase64 = makeThumbnail(bitmap);
    return {
      base64,
      mimeType,
      extension,
      colorSamples,
      thumbnailBase64,
      previewDataUrl: `data:${mimeType};base64,${base64}`,
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
