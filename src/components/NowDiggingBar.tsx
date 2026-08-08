import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import {
  getAlbumProgress,
  getArtistStatus,
  getResumePoint,
} from '../utils/derive';
import { useTracksByAlbum } from '../utils/hooks';
import { CoverImage } from './CoverImage';
import { PlayIcon } from './Icons';

/**
 * Persistent mini-player-like bar: cover, artist – resume track, thin
 * progress bar of the current album's digging progress, and a play glyph
 * that is actually the "이어서 듣기" Spotify deep link.
 */
export function NowDiggingBar() {
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const events = useLogStore((s) => s.events);
  const tracksByAlbum = useTracksByAlbum();

  const current = useMemo(() => {
    const albumList = Object.values(albums);
    const lastListen = new Map<string, string>();
    for (const e of events) {
      const prev = lastListen.get(e.artistId);
      if (!prev || e.listenedAt > prev) lastListen.set(e.artistId, e.listenedAt);
    }
    const inProgress = Object.values(artists)
      .filter((a) => getArtistStatus(a, albumList, tracksByAlbum) === 'in-progress')
      .sort((a, b) => {
        const ta = lastListen.get(a.id) ?? a.addedAt;
        const tb = lastListen.get(b.id) ?? b.addedAt;
        return tb.localeCompare(ta);
      });
    for (const artist of inProgress) {
      const rp = getResumePoint(artist, albumList, tracksByAlbum);
      if (rp) return { artist, rp };
    }
    return null;
  }, [artists, albums, events, tracksByAlbum]);

  if (!current) return null;

  const { artist, rp } = current;
  const progress = getAlbumProgress(rp.album, tracksByAlbum[rp.album.id] ?? []);

  return (
    <div className="glass-deep fixed inset-x-2 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-2xl lg:bottom-3 lg:left-[15rem] lg:right-4">
      <Link to={`/artist/${artist.id}`} className="flex items-center gap-3 p-2 pr-3">
        <CoverImage
          images={rp.album.images}
          alt={rp.album.name}
          sizePx={40}
          className="w-10"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {artist.name}
            <span className="text-white/50">
              {' — '}
              {rp.track ? rp.track.name : rp.album.name}
            </span>
          </p>
          <p className="truncate text-xs text-white/40">
            {progress.processed}/{progress.total} · {rp.album.name}
          </p>
        </div>
        <a
          href={spotifyAlbumUrl(rp.album.id)}
          target="_blank"
          rel="noreferrer"
          aria-label="이어서 듣기 (Spotify에서 열기)"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-base text-black transition-transform active:scale-95"
          onClick={(e) => e.stopPropagation()}
        >
          <PlayIcon size={16} className="translate-x-[1px]" />
        </a>
      </Link>
      <div className="absolute inset-x-0 top-0 h-[3px] bg-white/10">
        <div
          className="h-full bg-white/80 transition-[width] duration-300 ease-out"
          style={{ width: `${progress.ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
