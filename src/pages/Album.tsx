import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CoverImage, pickImage } from '../components/CoverImage';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalIcon,
  HeartIcon,
} from '../components/Icons';
import { ProgressRing } from '../components/ProgressRing';
import { RouteSheet } from '../components/RouteSheet';
import { StarRating } from '../components/StarRating';
import { TrackRow } from '../components/TrackRow';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { rgba, useDominantColor } from '../utils/color';
import { cn } from '../utils/cn';
import {
  getAlbumProgress,
  getAlbumTypeLabel,
  getInScopeAlbums,
  sortTracks,
} from '../utils/derive';
import { formatTotalDuration, releaseYear } from '../utils/format';
import { useIsMobile } from '../utils/hooks';

function AlbumContent({ albumId }: { albumId: string }) {
  const album = useArtistStore((s) => s.albums[albumId]);
  const artist = useArtistStore((s) => (album ? s.artists[album.artistId] : undefined));
  const albums = useArtistStore((s) => s.albums);
  const tracksMap = useArtistStore((s) => s.tracks);
  const ensureAlbumTracks = useArtistStore((s) => s.ensureAlbumTracks);
  const updateAlbum = useArtistStore((s) => s.updateAlbum);
  const navigate = useNavigate();

  const coverUrl = album ? pickImage(album.images, 320) : undefined;
  const accent = useDominantColor(coverUrl);

  const tracks = useMemo(
    () => Object.values(tracksMap).filter((t) => t.albumId === albumId),
    [tracksMap, albumId],
  );

  const [noteDraft, setNoteDraft] = useState(album?.note ?? '');
  useEffect(() => {
    setNoteDraft(album?.note ?? '');
  }, [album?.id, album?.note]);

  useEffect(() => {
    void ensureAlbumTracks(albumId);
  }, [albumId, ensureAlbumTracks]);

  if (!album) {
    return (
      <div className="py-24 text-center text-sm text-white/50">
        앨범을 찾을 수 없어요
      </div>
    );
  }

  const progress = getAlbumProgress(album, tracks);
  const totalMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);

  const siblings = artist ? getInScopeAlbums(artist, Object.values(albums)) : [];
  const idx = siblings.findIndex((al) => al.id === album.id);
  const prev = idx > 0 ? siblings[idx - 1] : undefined;
  const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined;

  const goSibling = (id: string) => {
    navigate(`/album/${id}`, { replace: true, state: window.history.state?.usr });
  };

  return (
    <div className="relative min-h-full overflow-hidden pb-10">
      {/* Dominant-color ambient backdrop derived from the cover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[26rem]"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, ${rgba(accent, 0.35)} 0%, rgba(11,11,15,0) 70%)`,
        }}
      />

      <div className="relative mx-auto max-w-2xl px-5 pt-4">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/80"
            onClick={() => navigate(-1)}
          >
            <ChevronLeftIcon size={18} />
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!prev}
              aria-label="이전 앨범"
              title={prev?.name}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/80 disabled:opacity-30"
              onClick={() => prev && goSibling(prev.id)}
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              type="button"
              disabled={!next}
              aria-label="다음 앨범"
              title={next?.name}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/80 disabled:opacity-30"
              onClick={() => next && goSibling(next.id)}
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <CoverImage
            images={album.images}
            alt={album.name}
            sizePx={280}
            rounded="rounded-xl"
            className="w-56 shadow-2xl md:w-64"
          />
          <h1 className="mt-5 text-2xl font-bold">{album.name}</h1>
          {artist && (
            <Link
              to={`/artist/${artist.id}`}
              className="mt-1 text-sm font-medium text-white/70 hover:text-white"
            >
              {artist.name}
            </Link>
          )}
          <p className="mt-1 text-xs text-white/45">
            {releaseYear(album.releaseDate)} · {getAlbumTypeLabel(album)} ·{' '}
            {progress.total}곡{totalMs > 0 && ` · ${formatTotalDuration(totalMs)}`}
          </p>

          <div className="mt-4 flex items-center gap-4">
            <StarRating
              size={22}
              value={album.rating}
              onChange={(v) => void updateAlbum(album.id, { rating: v })}
            />
            <button
              type="button"
              aria-label={album.likedAt ? '좋아요 해제' : '좋아요'}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors',
                album.likedAt ? 'text-rose-400' : 'text-white/40 hover:text-white/70',
              )}
              onClick={() =>
                void updateAlbum(album.id, {
                  likedAt: album.likedAt ? undefined : new Date().toISOString(),
                })
              }
            >
              <HeartIcon size={19} filled={Boolean(album.likedAt)} />
            </button>
            <div className="flex items-center gap-2">
              <ProgressRing
                ratio={progress.ratio}
                complete={progress.complete}
                size={40}
                accent={rgba(accent, 0.95)}
              />
              <span className="text-xs tabular-nums text-white/50">
                {progress.processed}/{progress.total}
              </span>
            </div>
          </div>

          <a
            href={spotifyAlbumUrl(album.id)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold text-black"
            style={{ background: rgba(accent, 1) }}
          >
            <ExternalIcon size={14} />
            Spotify에서 열기
          </a>
        </div>

        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            const note = noteDraft.trim();
            void updateAlbum(album.id, { note: note === '' ? undefined : note });
          }}
          rows={2}
          placeholder="이 앨범에 대한 메모"
          className="mt-6 w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none ring-1 ring-inset ring-white/10 focus:ring-white/25"
        />

        <div className="mt-4">
          {tracks.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              트랙 불러오는 중… (오프라인이라면 Spotify 연결 후 다시 열어주세요)
            </p>
          ) : (
            sortTracks(tracks).map((t) => (
              <TrackRow key={t.id} track={t} accent={rgba(accent, 0.95)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * /album/:id — full page on desktop; on mobile a bottom sheet over the
 * previous page. It is a real route: back/edge-swipe closes it and reload
 * restores it.
 */
export default function AlbumPage({ overlay = false }: { overlay?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const album = useArtistStore((s) => (id ? s.albums[id] : undefined));
  const loaded = useArtistStore((s) => s.loaded);

  if (!id) return null;
  if (!loaded) return null;

  if (overlay || isMobile) {
    return (
      <RouteSheet
        onClose={() => {
          if (overlay) {
            navigate(-1);
          } else if (album) {
            navigate(`/artist/${album.artistId}`, { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }}
      >
        <AlbumContent albumId={id} />
      </RouteSheet>
    );
  }

  return <AlbumContent albumId={id} />;
}
