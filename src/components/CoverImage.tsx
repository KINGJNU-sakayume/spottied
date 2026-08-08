import { useState } from 'react';
import type { SpotifyImage } from '../types';
import { cn } from '../utils/cn';
import { MusicNoteIcon } from './Icons';

export function pickImage(
  images: SpotifyImage[],
  minSize: number,
): string | undefined {
  if (images.length === 0) return undefined;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  let chosen = sorted[0];
  for (const img of sorted) {
    if ((img.width ?? Infinity) >= minSize) chosen = img;
  }
  return chosen.url;
}

/** Smallest available image, used as a blurred low-res placeholder. */
function pickPlaceholder(images: SpotifyImage[]): string | undefined {
  if (images.length === 0) return undefined;
  return [...images].sort(
    (a, b) => (a.width ?? Infinity) - (b.width ?? Infinity),
  )[0].url;
}

export function CoverImage({
  images,
  alt,
  className,
  rounded = 'rounded-xl',
  sizePx = 128,
}: {
  images: SpotifyImage[];
  alt: string;
  className?: string;
  rounded?: string;
  sizePx?: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const url = pickImage(images, sizePx * 2);
  const placeholder = pickPlaceholder(images);

  if (!url) {
    return (
      <div
        className={cn(
          'flex aspect-square items-center justify-center bg-ink/[0.06] text-ink/20 ring-1 ring-inset ring-ink/10',
          rounded,
          className,
        )}
      >
        <MusicNoteIcon size={Math.max(16, sizePx / 4)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden bg-ink/[0.04] ring-1 ring-inset ring-ink/10',
        rounded,
        className,
      )}
    >
      {placeholder && placeholder !== url && !loaded && (
        <img
          src={placeholder}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-md"
        />
      )}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={cn(
          'relative h-full w-full object-cover transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
