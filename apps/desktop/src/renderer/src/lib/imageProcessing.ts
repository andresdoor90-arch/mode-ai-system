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

/** Sample a downscaled grid of opaque pixels (most informative for colour). */
function sampleColors(bitmap: ImageBitmap, grid = 48): RgbSampleDTO[] {
  const canvas = document.createElement('canvas');
  const w = (canvas.width = Math.max(1, Math.min(grid, bitmap.width || grid)));
  const h = (canvas.height = Math.max(1, Math.min(grid, bitmap.height || grid)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) {
    return [];
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const samples: RgbSampleDTO[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha < 128) {
      continue; // skip transparent pixels (e.g. cut-out backgrounds)
    }
    samples.push({ r: data[i] ?? 0, g: data[i + 1] ?? 0, b: data[i + 2] ?? 0, weight: 1 });
  }
  return samples;
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
