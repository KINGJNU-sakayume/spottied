import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AmbientBackdrop } from '../components/AmbientBackdrop';
import { CoverImage, pickImage } from '../components/CoverImage';
import { ChevronDownIcon, PlayIcon, RefreshIcon } from '../components/Icons';
import { ProgressBar } from '../components/ProgressBar';
import { SyncReviewSheet } from '../components/SyncReviewSheet';
import { getLastExportAt } from '../db/backup';
import { spotifyAlbumUrl } from '../lib/spotify/endpoints';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import { useRecentStore } from '../store/recentStore';
import type { Album, Artist } from '../types';
import { cn } from '../utils/cn';
import { rgba, useDominantColor } from '../utils/color';
import {
  formatResumeText,
  getAlbumProgress,
  getInScopeAlbums,
  getResumePoint,
  listenStreak,
  onThisDay,
  suggestedUnheardAlbums,
  type TracksByAlbum,
} from '../utils/derive';
import { localDayKey } from '../utils/format';
import {
  useAlbumLinkState,
  useDiggingGroups,
  useOnline,
  useTracksByAlbum,
} from '../utils/hooks';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Every section is omitted entirely when empty — a bare heading reads worse. */
function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink/45">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Square cover + caption, the repeating unit of most sections here. */
function AlbumCard({
  album,
  caption,
  sub,
}: {
  album: Album;
  caption: string;
  sub?: string;
}) {
  const linkState = useAlbumLinkState();
  return (
    <Link
      to={`/album/${album.id}`}
      state={linkState}
      className="block min-w-0 transition-transform duration-150 active:scale-95"
    >
      <CoverImage
        images={album.images}
        alt={album.name}
        sizePx={160}
        rounded="rounded-[10px]"
        className="w-full shadow-md"
      />
      <p className="mt-1.5 truncate text-[13px] font-semibold leading-tight">
        {caption}
      </p>
      {sub && <p className="truncate text-[11px] text-ink/40">{sub}</p>}
    </Link>
  );
}

function TodaySummary() {
  const events = useLogStore((s) => s.events);
  const summary = useMemo(() => {
    const today = localDayKey(new Date().toISOString());
    const count = events.filter((e) => localDayKey(e.listenedAt) === today).length;
    return { count, streak: listenStreak(events).current };
  }, [events]);

  if (summary.count === 0) {
    return <p className="text-[15px] font-semibold text-ink/45">오늘은 아직 조용하네요</p>;
  }
  return (
    <p className="text-[15px] font-semibold">
      오늘 {summary.count}곡
      {summary.streak > 1 && (
        <span className="text-ink/45"> · 연속 {summary.streak}일</span>
      )}
    </p>
  );
}

function BackupReminder({ hasData }: { hasData: boolean }) {
  const events = useLogStore((s) => s.events);
  const artists = useArtistStore((s) => s.artists);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !hasData) return null;

  const lastExport = getLastExportAt();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();
  if (lastExport && lastExport > thirtyDaysAgo) return null;
  const since = lastExport ?? '';
  const hasNewRecords =
    events.some((e) => e.listenedAt > since) ||
    Object.values(artists).some((a) => a.addedAt > since);
  if (!hasNewRecords) return null;

  return (
    <div className="glass mb-4 flex items-center gap-3 rounded-[20px] p-3">
      <p className="min-w-0 flex-1 text-sm text-ink/70">
        기록이 이 브라우저에만 있어요. 백업해두는 게 좋아요.
      </p>
      <Link
        to="/settings"
        className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white"
      >
        백업하기
      </Link>
      <button
        type="button"
        className="shrink-0 text-sm text-ink/40 hover:text-ink/70"
        onClick={() => setDismissed(true)}
      >
        나중에
      </button>
    </div>
  );
}

/** The single most recent in-progress artist, given the most room on screen. */
function HeroCard({
  artist,
  tracksByAlbum,
}: {
  artist: Artist;
  tracksByAlbum: TracksByAlbum;
}) {
  const albums = useArtistStore((s) => s.albums);
  const albumList = useMemo(() => Object.values(albums), [albums]);
  const rp = getResumePoint(artist, albumList, tracksByAlbum);
  const coverUrl = rp ? pickImage(rp.album.images, 200) : undefined;
  const accent = useDominantColor(coverUrl);

  if (!rp) return null;
  const progress = getAlbumProgress(rp.album, tracksByAlbum[rp.album.id] ?? []);

  return (
    <div className="glass relative overflow-hidden rounded-[26px]">
      <AmbientBackdrop imageUrl={coverUrl} />
      <div className="relative flex flex-col gap-4 p-4 sm:flex-row">
        <CoverImage
          images={rp.album.images}
          alt={rp.album.name}
          sizePx={200}
          rounded="rounded-2xl"
          className="w-40 shrink-0 self-center shadow-xl sm:w-44 sm:self-auto"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/artist/${artist.id}`}
              className="block truncate text-xl font-bold"
            >
              {artist.name}
            </Link>
            <p className="mt-0.5 truncate text-sm text-ink/55">
              {formatResumeText(rp)}
            </p>
          </div>
          <div>
            <ProgressBar
              value={progress.ratio}
              accent={rgba(accent, 0.95)}
              className="mb-3"
            />
            <div className="flex items-center gap-2">
              <a
                href={spotifyAlbumUrl(rp.album.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform active:scale-95"
                style={{ background: rgba(accent, 1) }}
              >
                <PlayIcon size={13} />
                이어서 듣기
              </a>
              <Link
                to={`/artist/${artist.id}`}
                className="glass-inset whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-ink/65 transition-colors hover:text-ink"
              >
                아티스트
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NextUpSection({
  artists,
  tracksByAlbum,
}: {
  artists: Artist[];
  tracksByAlbum: TracksByAlbum;
}) {
  const albums = useArtistStore((s) => s.albums);
  const items = useMemo(() => {
    const albumList = Object.values(albums);
    return artists
      .map((artist) => ({
        artist,
        rp: getResumePoint(artist, albumList, tracksByAlbum),
      }))
      .filter((x): x is { artist: Artist; rp: NonNullable<typeof x.rp> } => x.rp != null);
  }, [artists, albums, tracksByAlbum]);

  if (items.length === 0) return null;
  return (
    <Section title="다음 차례">
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ artist, rp }) => (
          <AlbumCard
            key={artist.id}
            album={rp.album}
            caption={artist.name}
            sub={`${rp.albumIndex + 1}번째 앨범`}
          />
        ))}
      </div>
    </Section>
  );
}

function RecentlyPlayedSection() {
  const items = useRecentStore((s) => s.items);
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);

  const shelf = useMemo(() => {
    // One entry per album; a 50-track history is usually a handful of albums.
    const seen = new Set<string>();
    const out: Array<{
      albumId: string;
      name: string;
      images: Album['images'];
      artistId: string;
      artistName: string;
      known: boolean;
    }> = [];
    for (const item of items) {
      const album = item.track.album;
      if (!album?.id || seen.has(album.id)) continue;
      seen.add(album.id);
      const primary = item.track.artists[0];
      out.push({
        albumId: album.id,
        name: album.name,
        images: album.images ?? [],
        artistId: primary?.id ?? '',
        artistName: primary?.name ?? '',
        known: primary != null && artists[primary.id] != null,
      });
      if (out.length >= 12) break;
    }
    return out;
  }, [items, artists]);

  if (shelf.length === 0) return null;

  return (
    <Section title="최근 들은 앨범">
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        {shelf.map((entry) => {
          const tracked = albums[entry.albumId] != null;
          const inner = (
            <>
              <CoverImage
                images={entry.images}
                alt={entry.name}
                sizePx={120}
                rounded="rounded-[10px]"
                className="w-full shadow-md"
              />
              <p className="mt-1.5 truncate text-[13px] font-semibold leading-tight">
                {entry.name}
              </p>
              <p className="truncate text-[11px] text-ink/40">{entry.artistName}</p>
            </>
          );
          return (
            <div key={entry.albumId} className="w-28 shrink-0">
              {tracked ? (
                <Link
                  to={`/album/${entry.albumId}`}
                  className="block transition-transform duration-150 active:scale-95"
                >
                  {inner}
                </Link>
              ) : (
                <div>
                  {inner}
                  {/* An untracked artist here is the most natural way into
                      search — they already listened to them. */}
                  {entry.known ? (
                    <Link
                      to={`/artist/${entry.artistId}`}
                      className="mt-1 block truncate text-[11px] font-semibold text-ink/55"
                    >
                      아티스트 보기
                    </Link>
                  ) : (
                    <Link
                      to={`/search?q=${encodeURIComponent(entry.artistName)}`}
                      className="mt-1 block truncate text-[11px] font-semibold text-ink/55"
                    >
                      + 아티스트 추가
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function RevisitSection({
  artists,
  recencyOf,
}: {
  artists: Artist[];
  recencyOf: (artist: Artist) => string;
}) {
  const albums = useArtistStore((s) => s.albums);
  const tracksByAlbum = useTracksByAlbum();

  const stale = useMemo(() => {
    const cutoff = Date.now() - 30 * DAY_MS;
    const albumList = Object.values(albums);
    return artists
      .filter((a) => new Date(recencyOf(a)).getTime() < cutoff)
      .map((artist) => ({
        artist,
        days: Math.floor((Date.now() - new Date(recencyOf(artist)).getTime()) / DAY_MS),
        rp: getResumePoint(artist, albumList, tracksByAlbum),
      }))
      .filter((x): x is typeof x & { rp: NonNullable<typeof x.rp> } => x.rp != null)
      .sort((a, b) => b.days - a.days)
      .slice(0, 6);
  }, [artists, albums, tracksByAlbum, recencyOf]);

  if (stale.length === 0) return null;
  return (
    <Section title="다시 파러 가기">
      <div className="grid grid-cols-3 gap-3">
        {stale.map(({ artist, rp, days }) => (
          <AlbumCard
            key={artist.id}
            album={rp.album}
            caption={artist.name}
            sub={`마지막 청취 ${days}일 전`}
          />
        ))}
      </div>
    </Section>
  );
}

function SuggestionsSection() {
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const tracksByAlbum = useTracksByAlbum();

  const suggestions = useMemo(
    () =>
      suggestedUnheardAlbums(
        Object.values(artists),
        Object.values(albums),
        Object.values(tracks),
        tracksByAlbum,
        6,
      ),
    [artists, albums, tracks, tracksByAlbum],
  );

  if (suggestions.length === 0) return null;
  return (
    <Section title="취향에 맞을지도">
      <div className="grid grid-cols-3 gap-3">
        {suggestions.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            caption={album.name}
            sub={artists[album.artistId]?.name}
          />
        ))}
      </div>
    </Section>
  );
}

function OnThisDaySection() {
  const events = useLogStore((s) => s.events);
  const albums = useArtistStore((s) => s.albums);

  const covers = useMemo(() => {
    const seen = new Set<string>();
    const out: Album[] = [];
    for (const e of onThisDay(events)) {
      if (seen.has(e.albumId)) continue;
      seen.add(e.albumId);
      const album = albums[e.albumId];
      if (album) out.push(album);
      if (out.length >= 6) break;
    }
    return out;
  }, [events, albums]);

  if (covers.length === 0) return null;
  return (
    <Section title="작년 오늘">
      <div className="grid grid-cols-3 gap-3">
        {covers.map((album) => (
          <AlbumCard key={album.id} album={album} caption={album.name} />
        ))}
      </div>
    </Section>
  );
}

function CompletedSection({ artists }: { artists: Artist[] }) {
  if (artists.length === 0) return null;
  return (
    <Section title="완주">
      <div className="grid grid-cols-3 gap-3">
        {artists.map((artist) => (
          <Link
            key={artist.id}
            to={`/artist/${artist.id}`}
            className="block min-w-0 transition-transform duration-150 active:scale-95"
          >
            <CoverImage
              images={artist.images}
              alt={artist.name}
              sizePx={160}
              rounded="rounded-[10px]"
              className="w-full shadow-md"
            />
            <p className="mt-1.5 truncate text-[13px] font-semibold leading-tight">
              {artist.name}
            </p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

const WALL_PREVIEW = 20;

/** Every finished album, cover only. Accumulated achievement as visual density. */
function CoverWallSection() {
  const albums = useArtistStore((s) => s.albums);
  const artists = useArtistStore((s) => s.artists);
  const tracksByAlbum = useTracksByAlbum();
  const [expanded, setExpanded] = useState(false);
  const linkState = useAlbumLinkState();

  const wall = useMemo(() => {
    const out: Album[] = [];
    for (const artist of Object.values(artists)) {
      for (const album of getInScopeAlbums(artist, Object.values(albums))) {
        const tracks = tracksByAlbum[album.id] ?? [];
        if (tracks.length === 0) continue;
        if (getAlbumProgress(album, tracks).complete) out.push(album);
      }
    }
    return out;
  }, [albums, artists, tracksByAlbum]);

  if (wall.length === 0) return null;
  const shown = expanded ? wall : wall.slice(0, WALL_PREVIEW);

  return (
    <Section
      title={`커버 월 (${wall.length})`}
      action={
        wall.length > WALL_PREVIEW ? (
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-semibold text-ink/45"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? '접기' : '더 보기'}
            <ChevronDownIcon
              size={13}
              className={cn('transition-transform duration-200', expanded && 'rotate-180')}
            />
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {shown.map((album) => (
          <Link
            key={album.id}
            to={`/album/${album.id}`}
            state={linkState}
            title={album.name}
            className="w-14 transition-transform duration-150 active:scale-90"
          >
            <CoverImage
              images={album.images}
              alt={album.name}
              sizePx={56}
              rounded="rounded-md"
              className="w-full"
            />
          </Link>
        ))}
      </div>
    </Section>
  );
}

function NotStartedSection({ artists }: { artists: Artist[] }) {
  const [open, setOpen] = useState(false);
  if (artists.length === 0) return null;
  return (
    <section>
      <button
        type="button"
        className="mb-2 flex w-full items-center justify-between text-sm font-bold text-ink/45"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        미시작 ({artists.length})
        <ChevronDownIcon
          size={15}
          className={cn('transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="fade-in flex flex-wrap gap-2">
          {artists.map((artist) => {
            const img = pickImage(artist.images, 24);
            return (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                className="glass flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm font-medium"
              >
                {img ? (
                  <img src={img} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-ink/10" />
                )}
                <span className="max-w-[10rem] truncate">{artist.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const artists = useArtistStore((s) => s.artists);
  const loaded = useArtistStore((s) => s.loaded);
  const events = useLogStore((s) => s.events);
  const tracksByAlbum = useTracksByAlbum();
  const online = useOnline();
  const [syncOpen, setSyncOpen] = useState(false);
  const { inProgress, completed, notStarted, recencyOf } = useDiggingGroups();

  const loadCache = useRecentStore((s) => s.loadCache);
  const refresh = useRecentStore((s) => s.refresh);
  const recentLoaded = useRecentStore((s) => s.loaded);

  useEffect(() => {
    if (!recentLoaded) void loadCache();
  }, [recentLoaded, loadCache]);

  useEffect(() => {
    // Quietly top up the shelf on arrival; failures leave the cache showing.
    void refresh(5 * 60_000);
  }, [refresh]);

  const hasAny = Object.keys(artists).length > 0;
  const [hero, ...restInProgress] = inProgress;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <TodaySummary />
        <button
          type="button"
          disabled={!online}
          title={online ? undefined : '오프라인'}
          className="glass inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold text-ink/70 transition-colors hover:text-ink disabled:opacity-40"
          onClick={() => setSyncOpen(true)}
        >
          <RefreshIcon size={15} />
          가져오기
        </button>
      </div>

      <BackupReminder hasData={hasAny || events.length > 0} />

      {!loaded ? null : !hasAny ? (
        <div className="mt-24 text-center">
          <p className="text-lg font-bold text-ink/80">
            아직 디깅 중인 아티스트가 없어요
          </p>
          <p className="mt-1 text-sm text-ink/40">
            검색에서 아티스트를 추가하면 여기서 이어 들을 수 있어요.
          </p>
          <Link
            to="/search"
            className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-transform active:scale-95"
          >
            아티스트 검색하기
          </Link>
          <div>
            <button
              type="button"
              disabled={!online}
              className="mt-3 text-sm font-semibold text-ink/45 hover:text-ink/70 disabled:opacity-40"
              onClick={() => setSyncOpen(true)}
            >
              Spotify에서 최근 들은 곡 가져오기
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {hero && <HeroCard artist={hero} tracksByAlbum={tracksByAlbum} />}
          <NextUpSection artists={restInProgress} tracksByAlbum={tracksByAlbum} />
          <RecentlyPlayedSection />
          <RevisitSection artists={inProgress} recencyOf={recencyOf} />
          <SuggestionsSection />
          <OnThisDaySection />
          <CompletedSection artists={completed} />
          <CoverWallSection />
          <NotStartedSection artists={notStarted} />
        </div>
      )}

      {syncOpen && <SyncReviewSheet onClose={() => setSyncOpen(false)} />}
    </div>
  );
}
