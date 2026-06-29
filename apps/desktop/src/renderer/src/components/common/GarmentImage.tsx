/**
 * GarmentImage — displays a stored garment photo fetched over IPC.
 *
 * The sandboxed renderer has no filesystem access, so image bytes are pulled
 * through the typed IPC client (`ipc.getImage`) as base64 and shown as a data
 * URL. Results are cached per storage key (module-level) so re-renders and
 * revisits never re-fetch. While loading it shows a subtle shimmer; if there is
 * no key or the fetch fails it shows a tasteful garment monogram fallback.
 *
 * This avoids any custom protocol registration in the main process — image
 * delivery rides entirely on the proven IPC channel.
 */
import { Shirt } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '../../lib/cn';
import { ipc, isBridgeAvailable } from '../../ipc/client';

/** Cache of resolved data URLs keyed by storage key (shared across instances). */
const dataUrlCache = new Map<string, string>();

export interface GarmentImageProps {
  storageKey: string | undefined;
  alt: string;
  className?: string;
  iconClassName?: string;
}

export function GarmentImage({
  storageKey,
  alt,
  className,
  iconClassName,
}: GarmentImageProps): JSX.Element {
  const [src, setSrc] = useState<string | null>(() =>
    storageKey !== undefined ? (dataUrlCache.get(storageKey) ?? null) : null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (storageKey === undefined || storageKey.length === 0 || !isBridgeAvailable()) {
      setSrc(null);
      setFailed(storageKey !== undefined && storageKey.length > 0);
      return;
    }
    const cached = dataUrlCache.get(storageKey);
    if (cached !== undefined) {
      setSrc(cached);
      setFailed(false);
      return;
    }
    setSrc(null);
    setFailed(false);
    void ipc
      .getImage(storageKey)
      .then((image) => {
        if (!active) {
          return;
        }
        const url = `data:${image.mimeType};base64,${image.base64}`;
        dataUrlCache.set(storageKey, url);
        setSrc(url);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  if (failed || (storageKey === undefined && src === null)) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-muted to-muted/60',
          className,
        )}
        aria-label={alt}
        role="img"
      >
        <Shirt className={cn('h-10 w-10 text-muted-foreground/50', iconClassName)} />
      </div>
    );
  }

  if (src === null) {
    return (
      <div
        className={cn('animate-pulse bg-gradient-to-br from-muted to-muted/50', className)}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={cn('object-cover', className)}
    />
  );
}
