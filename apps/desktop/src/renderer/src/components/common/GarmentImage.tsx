/**
 * GarmentImage — lazy, cached image tile served from the `mas-img://` protocol.
 *
 * Given a stored image key it resolves the protocol URL and renders an `<img>`
 * with native lazy-loading and async decoding, so the catalog never blocks the
 * UI thread loading full-resolution originals. While the bytes load it shows a
 * subtle shimmer; if there is no key or the image fails, it shows a tasteful
 * garment monogram fallback. The browser/Electron HTTP cache (the protocol
 * sets a long `Cache-Control`) handles local caching.
 */
import { Shirt } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ipc } from '../../ipc/client';
import { cn } from '../../lib/cn';

export interface GarmentImageProps {
  /** Stored image key (thumbnail or original). */
  storageKey: string | undefined;
  alt: string;
  className?: string;
  /** Tailwind classes for the fallback icon size. */
  iconClassName?: string;
}

export function GarmentImage({
  storageKey,
  alt,
  className,
  iconClassName,
}: GarmentImageProps): JSX.Element {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const src = storageKey !== undefined && storageKey.length > 0 ? ipc.imageUrl(storageKey) : '';

  useEffect(() => {
    setStatus(src.length > 0 ? 'loading' : 'error');
  }, [src]);

  if (src.length === 0 || status === 'error') {
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

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted/50" />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setStatus('ready')}
        onError={() => setStatus('error')}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          status === 'ready' ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
