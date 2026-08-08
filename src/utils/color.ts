import { useEffect, useState } from 'react';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Apple Music-ish red, used until a cover's own color is available. */
export const DEFAULT_ACCENT: RGB = { r: 250, g: 45, b: 72 };

const cache = new Map<string, RGB>();

/**
 * Extracts a dominant color from a cover image via canvas sampling.
 * Falls back to a neutral accent when the image cannot be read (CORS, offline).
 */
export async function extractDominantColor(url: string): Promise<RGB> {
  const cached = cache.get(url);
  if (cached) return cached;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();

    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_ACCENT;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // Bucket by 3-bit channels; ignore near-black/near-white pixels.
    const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = r + g + b;
      if (lum < 60 || lum > 720) continue;
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
      buckets.set(key, bucket);
    }
    let best: { r: number; g: number; b: number; n: number } | null = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.n > best.n) best = bucket;
    }
    if (!best) return DEFAULT_ACCENT;

    let color: RGB = {
      r: Math.round(best.r / best.n),
      g: Math.round(best.g / best.n),
      b: Math.round(best.b / best.n),
    };
    color = deepen(color);
    cache.set(url, color);
    return color;
  } catch {
    return DEFAULT_ACCENT;
  }
}

const ACCENT_TARGET_LUMINANCE = 118;

/**
 * Accents sit on the white base and carry white text (buttons, fills), so a
 * pale cover color has to be pushed down into a readable range. Saturation is
 * nudged up at the same time to keep washed-out artwork from going grey.
 */
function deepen(c: RGB): RGB {
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (lum <= ACCENT_TARGET_LUMINANCE) return c;
  const factor = ACCENT_TARGET_LUMINANCE / lum;
  const scaled = {
    r: c.r * factor,
    g: c.g * factor,
    b: c.b * factor,
  };
  const mean = (scaled.r + scaled.g + scaled.b) / 3;
  const saturate = (v: number) =>
    Math.min(255, Math.max(0, Math.round(mean + (v - mean) * 1.25)));
  return { r: saturate(scaled.r), g: saturate(scaled.g), b: saturate(scaled.b) };
}

export function rgba(c: RGB, alpha: number): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

export function useDominantColor(url?: string): RGB {
  const [color, setColor] = useState<RGB>(() =>
    url ? (cache.get(url) ?? DEFAULT_ACCENT) : DEFAULT_ACCENT,
  );

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setColor(DEFAULT_ACCENT);
      return;
    }
    void extractDominantColor(url).then((c) => {
      if (!cancelled) setColor(c);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return color;
}
