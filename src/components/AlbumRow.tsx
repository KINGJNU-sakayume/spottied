import { useState } from 'react';
import { useArtistStore } from '../store/artistStore';
import type { Album, Track } from '../types';
import { cn } from '../utils/cn';
import { getAlbumProgress, getAlbumTypeLabel, sortTracks } from '../utils/derive';
import { releaseYear } from '../utils/format';
import { useOpenAlbum } from '../utils/hooks';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { CoverImage } from './CoverImage';
import { ChevronDownIcon, DotsIcon } from './Icons';
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
    <div className="glass overflow-hidden rounded-2xl">
      <div
        className="flex cursor-pointer items-center gap-3 p-3"
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
            className="w-14"
          />
          <span className="absolute inset-0 rounded-lg bg-white/0 transition-colors duration-150 group-hover:bg-white/10 group-active:bg-white/20" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{album.name}</p>
          <p className="mt-0.5 truncate text-xs text-white/50">
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
            'shrink-0 text-white/40 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
        />

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="앨범 메뉴"
            className="flex h-8 w-6 items-center justify-center text-white/35 hover:text-white/70"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <DotsIcon size={16} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="glass fade-in absolute right-0 top-8 z-30 w-48 overflow-hidden rounded-xl py-1 text-sm">
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left hover:bg-white/10"
                  onClick={() => {
                    setMenuOpen(false);
                    void markAlbumListened(album.id);
                  }}
                >
                  전부 청취 처리
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left hover:bg-white/10"
                  onClick={() => {
                    setMenuOpen(false);
                    void setAlbumExcluded(album.id, true);
                  }}
                >
                  목록에서 제외
                </button>
                <a
                  href={spotifyAlbumUrl(album.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full px-4 py-2.5 text-left hover:bg-white/10"
                  onClick={() => setMenuOpen(false)}
                >
                  Spotify에서 열기
                </a>
              </div>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-3 pb-3">
          {loading && tracks.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/40">
              트랙 불러오는 중…
            </p>
          ) : tracks.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/40">
              트랙 정보가 없어요. Spotify 연결 후 다시 열어주세요.
            </p>
          ) : (
            <>
              {sortTracks(tracks).map((t) => (
                <TrackRow key={t.id} track={t} accent={accent} />
              ))}
              {!progress.complete && (
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20"
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
