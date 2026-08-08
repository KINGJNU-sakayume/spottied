import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlbumTile } from '../components/AlbumTile';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { pickImage } from '../components/CoverImage';
import { ChevronDownIcon, ChevronLeftIcon } from '../components/Icons';
import { OverflowMenu, type OverflowMenuItem } from '../components/OverflowMenu';
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
  groupAlbumsByYear,
  releaseDateKey,
} from '../utils/derive';
import { releaseYear } from '../utils/format';
import { useOnline, useTracksByAlbum } from '../utils/hooks';
import { useLazyAlbumTracks } from '../utils/useLazyAlbumTracks';

const SCOPE_OPTIONS: Array<{ key: keyof ArtistScope; label: string }> = [
  { key: 'album', label: '정규' },
  { key: 'single', label: 'EP·싱글' },
  { key: 'compilation', label: '컴필레이션' },
];

/**
 * Watches a sentinel and reports whether it has scrolled off the top.
 * Returns a *callback* ref, not a ref object: the sentinel only mounts after
 * the store finishes loading, and an effect keyed on a ref object would have
 * already run against a null node and never re-run.
 */
function usePassedBy(): [(el: HTMLElement | null) => void, boolean] {
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setPassed(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel]);
  return [setSentinel, passed];
}

export default function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const loaded = useArtistStore((s) => s.loaded);
  const artist = useArtistStore((s) => (id ? s.artists[id] : undefined));
  const albums = useArtistStore((s) => s.albums);
  const setScope = useArtistStore((s) => s.setScope);
  const setAlbumExcluded = useArtistStore((s) => s.setAlbumExcluded);
  const refreshDiscography = useArtistStore((s) => s.refreshDiscography);
  const pushToast = useUiStore((s) => s.pushToast);
  const connected = useUiStore((s) => s.spotifyConnected);
  const tracksByAlbum = useTracksByAlbum();
  const online = useOnline();

  const [excludedOpen, setExcludedOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [headerEndRef, compact] = usePassedBy();

  const albumList = useMemo(() => Object.values(albums), [albums]);
  const headerImg = artist ? pickImage(artist.images, 320) : undefined;
  // One extraction for the whole grid — per-tile sampling would decode a
  // canvas for every cover on screen.
  const accent = useDominantColor(headerImg);
  const { observe } = useLazyAlbumTracks({
    resetKey: id ?? '',
    enabled: online && connected,
  });

  if (!loaded) return null;
  if (!artist) {
    return (
      <div className="mt-24 text-center text-sm text-ink/50">
        아티스트를 찾을 수 없어요.{' '}
        <Link to="/" className="font-semibold text-ink underline">
          홈으로
        </Link>
      </div>
    );
  }

  const inScope = getInScopeAlbums(artist, albumList);
  const yearGroups = groupAlbumsByYear(inScope);
  const excluded = albumList
    .filter((al) => al.artistId === artist.id && al.excluded)
    .sort((a, b) =>
      releaseDateKey(a.releaseDate).localeCompare(releaseDateKey(b.releaseDate)),
    );
  const status = getArtistStatus(artist, albumList, tracksByAlbum);
  const progress = getArtistProgress(artist, albumList, tracksByAlbum);
  const accentCss = rgba(accent, 0.95);

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

  const menuItems: OverflowMenuItem[] = [
    {
      label: refreshing ? '새로고침 중…' : '디스코그래피 새로고침',
      onSelect: () => {
        if (!online) {
          pushToast('오프라인이에요');
          return;
        }
        void onRefresh();
      },
    },
    {
      label: 'Spotify에서 가져오기',
      onSelect: () => {
        if (!online) {
          pushToast('오프라인이에요');
          return;
        }
        setSyncOpen(true);
      },
    },
    { label: 'Spotify에서 열기', href: spotifyArtistUrl(artist.id) },
  ];

  return (
    <div>
      {/* Compact bar takes over once the real header scrolls away, so the
          artist and their progress stay on screen through a long grid. */}
      <div
        className={cn(
          'glass-bar fixed inset-x-0 top-0 z-20 h-[52px] transition-opacity duration-200 lg:left-56',
          compact ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!compact}
      >
        <div className="mx-auto flex h-full max-w-3xl items-center gap-3 px-4">
          <Link
            to="/"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/70"
            aria-label="뒤로"
            tabIndex={compact ? 0 : -1}
          >
            <ChevronLeftIcon size={18} />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-bold">{artist.name}</p>
          <span className="shrink-0 text-xs font-medium tabular-nums text-ink/45">
            {Math.round(progress.ratio * 100)}%
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-ink/[0.08]">
          <div
            className="h-full transition-[width] duration-300 ease-out"
            style={{ width: `${progress.ratio * 100}%`, background: accentCss }}
          />
        </div>
      </div>

      <header className="relative -mx-4 -mt-4 mb-5 overflow-hidden px-4 pb-5 pt-4">
        <AmbientBackdrop imageUrl={headerImg} />
        <div className="relative">
          <div className="mb-4 flex items-start justify-between gap-3">
            <Link
              to="/"
              className="glass inline-flex h-9 w-9 items-center justify-center rounded-full text-ink/70"
              aria-label="뒤로"
            >
              <ChevronLeftIcon size={18} />
            </Link>
            {/* Three action pills collapsed into one menu: they pushed the
                album grid below the fold on every phone. */}
            <div className="glass flex h-9 w-9 items-center justify-center rounded-full">
              <OverflowMenu
                label="아티스트 메뉴"
                open={menuOpen}
                onOpenChange={setMenuOpen}
                items={menuItems}
              />
            </div>
          </div>

          <div className="flex items-end gap-4">
            {headerImg && (
              <img
                src={headerImg}
                alt={artist.name}
                className="h-24 w-24 shrink-0 rounded-[22px] object-cover shadow-xl ring-1 ring-inset ring-ink/10 md:h-28 md:w-28"
              />
            )}
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-[30px] font-bold tracking-tight">
                {artist.name}
              </h1>
              {/* Genres are gone: Spotify deprecated the field in 2026-02, so
                  newly added artists have none and the row jittered. */}
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink/50">
              <span>
                {progress.processed} / {progress.total} 트랙
              </span>
              <span>{Math.round(progress.ratio * 100)}%</span>
            </div>
            <ProgressBar value={progress.ratio} accent={accentCss} />
          </div>

          <div className="glass-inset mt-4 inline-flex rounded-full p-1">
            {SCOPE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                aria-pressed={artist.scope[key]}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
                  artist.scope[key]
                    ? 'text-white shadow-sm'
                    : 'text-ink/45 hover:text-ink/75',
                )}
                style={artist.scope[key] ? { background: accentCss } : undefined}
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

      {/* h-px, not a bare div: a zero-area target never reports an
          intersection, so the compact bar would never toggle. */}
      <div ref={headerEndRef} className="h-px" aria-hidden />

      {inScope.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink/40">
          현재 범위에 해당하는 앨범이 없어요. 범위 토글을 확인해 주세요.
        </p>
      ) : (
        <div className="space-y-6">
          {yearGroups.map(({ year, albums: yearAlbums }) => (
            <section key={year}>
              <h2 className="mb-2 text-[11px] font-semibold tabular-nums text-ink/40">
                {year}
              </h2>
              {/* Two columns on phones, never three: a third column shrinks the
                  cell below what a draggable 16px star row needs. */}
              <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-4">
                {yearAlbums.map((album) => (
                  <AlbumTile
                    key={album.id}
                    album={album}
                    tracks={tracksByAlbum[album.id] ?? []}
                    accent={accentCss}
                    tileRef={observe(album.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {excluded.length > 0 && (
        <section className="mt-6">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm font-medium text-ink/45"
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
                  className="glass-inset flex items-center gap-3 rounded-[18px] p-2.5 opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{album.name}</p>
                    <p className="text-xs text-ink/40">
                      {releaseYear(album.releaseDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-ink/[0.08] px-3 py-1.5 text-xs font-semibold hover:bg-ink/[0.14]"
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
