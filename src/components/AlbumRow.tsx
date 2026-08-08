import { useState } from 'react';
import { useArtistStore } from '../store/artistStore';
import type { Album, Track } from '../types';
import { cn } from '../utils/cn';
import { getAlbumProgress, getAlbumTypeLabel, sortTracks } from '../utils/derive';
import { releaseYear } from '../utils/format';
import { useOpenAlbum } from '../utils/hooks';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { CoverImage } from './CoverImage';
import { ChevronDownIcon } from './Icons';
import { OverflowMenu } from './OverflowMenu';
import { ProgressRing } from './ProgressRing';
import { StarRating } from './StarRating';
import { TrackRow } from './TrackRow';

/**
 * Album timeline row: the row body toggles the inline track checklist;
 * tapping the cover navigates to /album/:id.
 */
export function AlbumRow({
  album,
  tracks,
  accent,
  expanded,
  onToggle,
}: {
  album: Album;
  tracks: Track[];
  accent?: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const openAlbum = useOpenAlbum();
  const markAlbumListened = useArtistStore((s) => s.markAlbumListened);
  const setAlbumExcluded = useArtistStore((s) => s.setAlbumExcluded);
  const loading = useArtistStore((s) => Boolean(s.loadingTrackAlbums[album.id]));
  const [menuOpen, setMenuOpen] = useState(false);

  const progress = getAlbumProgress(album, tracks);

  return (
    <div className="glass overflow-hidden rounded-[22px]">
      <div
        className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-white/25"
        onClick={onToggle}
        role="button"
        aria-expanded={expanded}
      >
        <button
          type="button"
          aria-label={`${album.name} 앨범 페이지 열기`}
          className="group relative shrink-0 transition-transform duration-150 active:scale-95"
          onClick={(e) => {
            e.stopPropagation();
            openAlbum(album.id);
          }}
        >
          <CoverImage
            images={album.images}
            alt={album.name}
            sizePx={56}
            className="w-14 shadow-md"
          />
          <span className="absolute inset-0 rounded-xl bg-ink/0 transition-colors duration-150 group-hover:bg-ink/10 group-active:bg-ink/20" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{album.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink/50">
            {releaseYear(album.releaseDate)} · {getAlbumTypeLabel(album)} ·{' '}
            {progress.processed}/{progress.total}곡
          </p>
          {album.rating != null && (
            <StarRating size={10} value={album.rating} readOnly className="mt-1" />
          )}
        </div>

        <ProgressRing
          ratio={progress.ratio}
          complete={progress.complete}
          size={34}
          accent={accent}
        />

        <ChevronDownIcon
          size={16}
          className={cn(
            'shrink-0 text-ink/35 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />

        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <OverflowMenu
            label="앨범 메뉴"
            open={menuOpen}
            onOpenChange={setMenuOpen}
            items={[
              {
                label: '전부 청취 처리',
                onSelect: () => void markAlbumListened(album.id),
              },
              {
                label: '목록에서 제외',
                onSelect: () => void setAlbumExcluded(album.id, true),
              },
              { label: 'Spotify에서 열기', href: spotifyAlbumUrl(album.id) },
            ]}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-ink/[0.07] px-3 pb-3">
          {loading && tracks.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink/40">
              트랙 불러오는 중…
            </p>
          ) : tracks.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink/40">
              트랙 정보가 없어요. Spotify 연결 후 다시 열어주세요.
            </p>
          ) : (
            <>
              {sortTracks(tracks).map((t) => (
                <TrackRow key={t.id} track={t} />
              ))}
              {!progress.complete && (
                <button
                  type="button"
                  className="glass-inset mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
                  onClick={() => void markAlbumListened(album.id)}
                >
                  전부 청취 처리
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
