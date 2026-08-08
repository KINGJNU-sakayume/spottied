import type { Artist } from '../types';
import { cn } from '../utils/cn';
import { CoverImage } from './CoverImage';

/**
 * Horizontal artist picker. Replaces a native <select>, which was the one
 * control in the app that broke the glass language — and gave no hint of
 * which artists actually have records.
 */
export function ArtistFilterChips({
  artists,
  value,
  onChange,
  allLabel = '전체',
  className,
}: {
  artists: Artist[];
  /** '' means no filter. */
  value: string;
  onChange: (artistId: string) => void;
  allLabel?: string;
  className?: string;
}) {
  if (artists.length === 0) return null;
  return (
    <div
      className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4', className)}
      role="group"
      aria-label="아티스트 필터"
    >
      <button
        type="button"
        aria-pressed={value === ''}
        className={cn(
          'shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors',
          value === '' ? 'bg-ink text-white shadow-sm' : 'glass-inset text-ink/55',
        )}
        onClick={() => onChange('')}
      >
        {allLabel}
      </button>
      {artists.map((artist) => {
        const active = value === artist.id;
        return (
          <button
            key={artist.id}
            type="button"
            aria-pressed={active}
            className={cn(
              'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-semibold transition-colors',
              active ? 'bg-ink text-white shadow-sm' : 'glass-inset text-ink/55',
            )}
            onClick={() => onChange(active ? '' : artist.id)}
          >
            <CoverImage
              images={artist.images}
              alt=""
              sizePx={28}
              rounded="rounded-full"
              className="w-7 shrink-0"
            />
            <span className="max-w-[9rem] truncate">{artist.name}</span>
          </button>
        );
      })}
    </div>
  );
}
