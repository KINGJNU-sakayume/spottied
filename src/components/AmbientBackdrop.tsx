import { cn } from '../utils/cn';

/**
 * Renders the dominant cover art underneath the content: scaled ~1.4x,
 * heavily blurred and saturated, with a dark gradient overlay for contrast.
 */
export function AmbientBackdrop({
  imageUrl,
  className,
}: {
  imageUrl?: string;
  className?: string;
}) {
  if (!imageUrl) return null;
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full scale-[1.4] object-cover opacity-60 blur-[60px] saturate-[1.6]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-base/40 via-base/70 to-base" />
    </div>
  );
}
