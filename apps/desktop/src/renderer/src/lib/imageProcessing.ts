/**
 * Browser-side image processing for the photo-first flow.
 *
 * Runs in the Electron renderer (real Chromium, so `Image`, `<canvas>` and
 * WebP encoding are available). It performs the work that must happen close to
 * the pixels:
 *   - read the original bytes as base64 (to persist the untouched original),
 *   - sample a downscaled grid of opaque pixels for the offline colour baseline,
 *   - render an optimized WebP thumbnail (so the catalog never loads full-res).
 *
 * No fabrication and no network: everything is derived from the actual image.
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
  /** Base64 of the optimized WebP thumbnail (no prefix). */
  readonly thumbnailBase64: string;
  /** Object URL for immediate on-screen preview (revoke when done). */
  readonly previewUrl: string;
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const extensionFor = (file: File): string => {
  const fromName = file.name.includes('.')
    ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase()
    : '';
  if (fromName.length > 0) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  return EXT_BY_MIME[file.type] ?? 'png';
};

const stripDataUrlPrefix = (dataUrl: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
};

const readAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The selected file is not a readable image.'));
    img.src = url;
  });

/** Sample a downscaled grid of opaque pixels (most informative for colour). */
function sampleColors(img: HTMLImageElement, grid = 48): RgbSampleDTO[] {
  const canvas = document.createElement('canvas');
  const w = (canvas.width = Math.max(1, Math.min(grid, img.naturalWidth || grid)));
  const h = (canvas.height = Math.max(1, Math.min(grid, img.naturalHeight || grid)));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) {
    return [];
  }
  ctx.drawImage(img, 0, 0, w, h);
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

/** Render an optimized WebP thumbnail; falls back to JPEG if WebP is absent. */
function makeThumbnail(img: HTMLImageElement, maxDim = 512, quality = 0.82): string {
  const ratio = Math.min(
    1,
    maxDim / Math.max(img.naturalWidth || maxDim, img.naturalHeight || maxDim),
  );
  const w = Math.max(1, Math.round((img.naturalWidth || maxDim) * ratio));
  const h = Math.max(1, Math.round((img.naturalHeight || maxDim) * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return '';
  }
  ctx.drawImage(img, 0, 0, w, h);
  let dataUrl = canvas.toDataURL('image/webp', quality);
  if (!dataUrl.startsWith('data:image/webp')) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return stripDataUrlPrefix(dataUrl);
}

/**
 * Prepare a picked image file: read bytes, sample colours and build a
 * thumbnail. The caller is responsible for revoking `previewUrl`.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  const dataUrl = await readAsDataUrl(file);
  const previewUrl = URL.createObjectURL(file);
  const img = await loadImage(previewUrl);
  return {
    base64: stripDataUrlPrefix(dataUrl),
    mimeType: file.type.length > 0 ? file.type : 'image/png',
    extension: extensionFor(file),
    colorSamples: sampleColors(img),
    thumbnailBase64: makeThumbnail(img),
    previewUrl,
  };
}
