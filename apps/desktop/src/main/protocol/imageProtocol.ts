/**
 * `mas-img://` custom protocol — serves stored garment images to the renderer.
 *
 * The renderer is sandboxed and has no filesystem access, so it cannot read
 * image bytes directly. Instead it references images by a stable URL
 * (`mas-img://media/<urlencoded-storage-key>`) which this protocol resolves
 * against the {@link ImageStorageService}, streaming back the bytes with the
 * right content type. Keys are validated by the storage layer (path-traversal
 * is rejected), so only files inside the image root can ever be served.
 *
 * The scheme is registered as privileged BEFORE `app.whenReady()` so it behaves
 * like `https` (secure, fetchable, cacheable); the handler is installed after
 * the container exists.
 */
import { protocol } from 'electron';

import type { ImageStorageService } from '@mas/infrastructure';

/** The custom scheme name. */
export const IMAGE_SCHEME = 'mas-img';

const CONTENT_TYPE_BY_EXT: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

const contentTypeForKey = (key: string): string => {
  const dot = key.lastIndexOf('.');
  const ext = dot >= 0 ? key.slice(dot + 1).toLowerCase() : '';
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
};

/**
 * Register the `mas-img` scheme as privileged. MUST be called before the app is
 * ready (Electron requirement for `registerSchemesAsPrivileged`).
 */
export function registerImageProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: IMAGE_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/** Decode the storage key from a `mas-img://media/<encoded-key>` URL. */
function keyFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    // Path is `/<encoded-key>`; drop the leading slash and decode.
    const encoded = url.pathname.replace(/^\//, '');
    if (encoded.length === 0) {
      return null;
    }
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Install the `mas-img` request handler. Call once, after the app is ready and
 * the container (hence the image store) exists.
 */
export function registerImageProtocol(images: ImageStorageService): void {
  protocol.handle(IMAGE_SCHEME, async (request) => {
    const key = keyFromUrl(request.url);
    if (key === null) {
      return new Response('Bad image request', { status: 400 });
    }
    try {
      const bytes = await images.getImage(key);
      // Copy into a fresh ArrayBuffer so the Response body is a clean BodyInit.
      const body = new Uint8Array(bytes);
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': contentTypeForKey(key),
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      });
    } catch {
      return new Response('Image not found', { status: 404 });
    }
  });
}
