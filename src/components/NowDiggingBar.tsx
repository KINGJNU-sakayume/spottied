import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { rgba, useDominantColor } from '../utils/color';
import { getAlbumProgress, getResumePoint } from '../utils/derive';
import { useDiggingGroups, useTracksByAlbum } from '../utils/hooks';
import { CoverImage, pickImage } from './CoverImage';
import { PlayIcon } from './Icons';

/**
 * Persistent mini-player-like bar: cover, artist – resume track, thin
 * progress bar of the current album's digging progress, and a play glyph
 * that is actually the "이어서 듣기" Spotify deep link.
 */
export function NowDiggingBar() {
  const albums = useArtistStore((s) => s.albums);
  const tracksByAlbum = useTracksByAlbum();

  const { inProgress } = useDiggingGroups();

  const current = useMemo(() => {
    const albumList = Object.values(albums);
    for (const artist of inProgress) {
      const rp = getResumePoint(artist, albumList, tracksByAlbum);
      if (rp) return { artist, rp };
    }
    return null;
  }, [inProgress, albums, tracksByAlbum]);

  const accent = useDominantColor(
    current ? pickImage(current.rp.album.images, 80) : undefined,
  );

  if (!current) return null;

  const { artist, rp } = current;
  const progress = getAlbumProgress(rp.album, tracksByAlbum[rp.album.id] ?? []);

  return (
    <div className="glass-bar fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-[20px] lg:bottom-4 lg:left-[15rem] lg:right-4">
      {/* The play link is a sibling of the artist link, not a child: an <a>
          inside an <a> is invalid and browsers unnest it unpredictably. */}
      <div className="flex items-center gap-3 p-2 pr-3">
        <Link
          to={`/artist/${artist.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <CoverImage
            images={rp.album.images}
            alt={rp.album.name}
            sizePx={40}
            rounded="rounded-lg"
            className="w-10 shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {artist.name}
              <span className="font-normal text-ink/45">
                {' — '}
                {rp.track ? rp.track.name : rp.album.name}
              </span>
            </p>
            <p className="truncate text-xs text-ink/40">
              {progress.processed}/{progress.total} · {rp.album.name}
            </p>
          </div>
        </Link>
        <a
          href={spotifyAlbumUrl(rp.album.id)}
          target="_blank"
          rel="noreferrer"
          aria-label="이어서 듣기 (Spotify에서 열기)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform active:scale-95"
          style={{ background: rgba(accent, 1) }}
        >
          <PlayIcon size={16} className="translate-x-[1px]" />
        </a>
      </div>
      <div className="absolute inset-x-0 top-0 h-[3px] bg-ink/[0.08]">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{ width: `${progress.ratio * 100}%`, background: rgba(accent, 0.9) }}
        />
      </div>
    </div>
  );
}
