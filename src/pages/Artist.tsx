import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlbumRow } from '../components/AlbumRow';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { pickImage } from '../components/CoverImage';
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ExternalIcon,
  RefreshIcon,
} from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { StatusBadge } from '../components/StatusBadge';
import { SyncReviewSheet } from '../components/SyncReviewSheet';
import { spotifyArtistUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { useUiStore } from '../store/uiStore';
import type { ArtistScope } from '../types';
import { rgba, useDominantColor } from '../utils/color';
import { cn } from '../utils/cn';
import {
  getArtistProgress,
  getArtistStatus,
  getInScopeAlbums,
  releaseDateKey,
} from '../utils/derive';
import { releaseYear } from '../utils/format';
import { useOnline, useTracksByAlbum } from '../utils/hooks';

const SCOPE_OPTIONS: Array<{ key: keyof ArtistScope; label: string }> = [
  { key: 'album', label: '정규' },
  { key: 'single', label: 'EP·싱글' },
  { key: 'compilation', label: '컴필레이션' },
];

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const loaded = useArtistStore((s) => s.loaded);
  const artist = useArtistStore((s) => (id ? s.artists[id] : undefined));
  const albums = useArtistStore((s) => s.albums);
  const setScope = useArtistStore((s) => s.setScope);
  const setAlbumExcluded = useArtistStore((s) => s.setAlbumExcluded);
  const ensureAlbumTracks = useArtistStore((s) => s.ensureAlbumTracks);
  const refreshDiscography = useArtistStore((s) => s.refreshDiscography);
  const pushToast = useUiStore((s) => s.pushToast);
  const tracksByAlbum = useTracksByAlbum();
  const online = useOnline();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const albumList = useMemo(() => Object.values(albums), [albums]);
  const headerImg = artist ? pickImage(artist.images, 320) : undefined;
  const accent = useDominantColor(headerImg);

  if (!loaded) return null;
  if (!artist) {
    return (
      <div className="mt-24 text-center text-sm text-white/50">
        아티스트를 찾을 수 없어요.{' '}
        <Link to="/" className="text-white underline">
          홈으로
        </Link>
      </div>
    );
  }

  const inScope = getInScopeAlbums(artist, albumList);
  const excluded = albumList
    .filter((al) => al.artistId === artist.id && al.excluded)
    .sort((a, b) =>
      releaseDateKey(a.releaseDate).localeCompare(releaseDateKey(b.releaseDate)),
    );
  const status = getArtistStatus(artist, albumList, tracksByAlbum);
  const progress = getArtistProgress(artist, albumList, tracksByAlbum);

  const toggleExpanded = (albumId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
        void ensureAlbumTracks(albumId);
      }
      return next;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshDiscography(artist.id);
      pushToast('디스코그래피를 새로고침했어요');
    } catch {
      pushToast('새로고침에 실패했어요');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <header className="relative -mx-4 -mt-4 mb-5 overflow-hidden px-4 pb-5 pt-4">
        <AmbientBackdrop imageUrl={headerImg} />
        <div className="relative">
          <Link
            to="/"
            className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/80"
            aria-label="뒤로"
          >
            <ChevronLeftIcon size={18} />
          </Link>

          <div className="flex items-end gap-4">
            {headerImg && (
              <img
                src={headerImg}
                alt={artist.name}
                className="h-24 w-24 shrink-0 rounded-2xl object-cover shadow-2xl ring-1 ring-inset ring-white/10 md:h-28 md:w-28"
              />
            )}
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-3xl font-bold">{artist.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                {artist.genres.length > 0 && (
                  <span className="truncate text-xs text-white/50">
                    {artist.genres.slice(0, 3).join(' · ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-white/50">
              <span>
                {progress.processed} / {progress.total} 트랙
              </span>
              <span>{Math.round(progress.ratio * 100)}%</span>
            </div>
            <ProgressBar value={progress.ratio} accent={rgba(accent, 0.95)} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={refreshing || !online}
              title={online ? undefined : '오프라인'}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-40"
              onClick={() => void onRefresh()}
            >
              <RefreshIcon size={13} className={refreshing ? 'animate-spin' : undefined} />
              디스코그래피 새로고침
            </button>
            <button
              type="button"
              disabled={!online}
              title={online ? undefined : '오프라인'}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 hover:bg-white/20 disabled:opacity-40"
              onClick={() => setSyncOpen(true)}
            >
              Spotify에서 가져오기
            </button>
            <a
              href={spotifyArtistUrl(artist.id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 hover:bg-white/20"
            >
              <ExternalIcon size={13} />
              Spotify에서 열기
            </a>
          </div>

          <div className="mt-4 inline-flex rounded-full bg-black/30 p-1">
            {SCOPE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={artist.scope[key]}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                  artist.scope[key] ? 'text-black' : 'text-white/50 hover:text-white/80',
                )}
                style={artist.scope[key] ? { background: rgba(accent, 0.95) } : undefined}
                onClick={() =>
                  void setScope(artist.id, {
                    ...artist.scope,
                    [key]: !artist.scope[key],
                  })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-2.5">
        {inScope.length === 0 && (
          <p className="py-12 text-center text-sm text-white/40">
            현재 범위에 해당하는 앨범이 없어요. 범위 토글을 확인해 주세요.
          </p>
        )}
        {inScope.map((album) => (
          <AlbumRow
            key={album.id}
            album={album}
            tracks={tracksByAlbum[album.id] ?? []}
            accent={rgba(accent, 0.95)}
            expanded={expandedIds.has(album.id)}
            onToggle={() => toggleExpanded(album.id)}
          />
        ))}
      </div>

      {excluded.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm text-white/50"
            onClick={() => setExcludedOpen((v) => !v)}
          >
            제외됨 ({excluded.length})
            <ChevronDownIcon
              size={15}
              className={cn('transition-transform duration-200', excludedOpen && 'rotate-180')}
            />
          </button>
          {excludedOpen && (
            <div className="mt-1 space-y-1.5">
              {excluded.map((album) => (
                <div
                  key={album.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5 opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{album.name}</p>
                    <p className="text-xs text-white/40">
                      {releaseYear(album.releaseDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
                    onClick={() => void setAlbumExcluded(album.id, false)}
                  >
                    복원
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {syncOpen && <SyncReviewSheet onClose={() => setSyncOpen(false)} />}
    </div>
  );
}
