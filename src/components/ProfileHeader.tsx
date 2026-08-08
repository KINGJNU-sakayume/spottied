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
      <div className="glass flex gap-3 rounded-[22px] p-4">
        <div className="flex-1">
          <p className="text-3xl font-bold tabular-nums">{totalListenedTracks}</p>
          <p className="text-sm text-ink/50">청취한 트랙</p>
        </div>
        <div className="w-px bg-ink/[0.08]" />
        <div className="flex-1 pl-1">
          <p className="text-3xl font-bold tabular-nums">{completedArtistCount}</p>
          <p className="text-sm text-ink/50">완주한 아티스트</p>
        </div>
      </div>

      {showcase.length > 0 && (
        <div className="no-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
          {showcase.map((item) => (
            <button
              key={item.key}
              type="button"
              className="w-20 shrink-0 text-left transition-transform duration-150 active:scale-95"
              onClick={() => onShowcaseItemClick?.(item)}
            >
              <CoverImage
                images={item.images}
                alt={item.name}
                sizePx={80}
                rounded={item.kind === 'artist' ? 'rounded-full' : 'rounded-xl'}
                className="w-20"
              />
              <p className="mt-1.5 truncate text-xs font-medium text-ink/75">
                {item.name}
              </p>
              <p className="text-[11px] tabular-nums text-amber-600">
                ★ {item.rating.toFixed(1)}
              </p>
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
