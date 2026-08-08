import type { SpotifyImage } from '../types';
import { CoverImage } from './CoverImage';

export interface ShowcaseItem {
  key: string;
  name: string;
  images: SpotifyImage[];
  rating: number;
  kind: 'artist' | 'album';
  linkTo?: string;
}

/**
 * Standalone, prop-driven profile header — the seed of the v2 achievement
 * showcase. No page-local coupling: everything arrives via props.
 */
export function ProfileHeader({
  totalListenedTracks,
  completedArtistCount,
  showcase,
  onShowcaseItemClick,
}: {
  totalListenedTracks: number;
  completedArtistCount: number;
  showcase: ShowcaseItem[];
  onShowcaseItemClick?: (item: ShowcaseItem) => void;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-end gap-6">
        <div>
          <p className="text-3xl font-bold tabular-nums">{totalListenedTracks}</p>
          <p className="text-sm text-white/50">청취한 트랙</p>
        </div>
        <div>
          <p className="text-3xl font-bold tabular-nums">{completedArtistCount}</p>
          <p className="text-sm text-white/50">완주한 아티스트</p>
        </div>
      </div>

      {showcase.length > 0 && (
        <div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-1">
          {showcase.map((item) => (
            <button
              key={item.key}
              type="button"
              className="w-20 shrink-0 text-left"
              onClick={() => onShowcaseItemClick?.(item)}
            >
              <CoverImage
                images={item.images}
                alt={item.name}
                sizePx={80}
                rounded={item.kind === 'artist' ? 'rounded-full' : 'rounded-lg'}
                className="w-20"
              />
              <p className="mt-1.5 truncate text-xs text-white/70">{item.name}</p>
              <p className="text-[11px] tabular-nums text-amber-300">
                ★ {item.rating.toFixed(1)}
              </p>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
