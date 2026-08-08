import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArtistFilterChips } from '../components/ArtistFilterChips';
import { CoverImage } from '../components/CoverImage';
import { ChevronDownIcon, XIcon } from '../components/Icons';
import { ListenHeatmap } from '../components/ListenHeatmap';
import { ProfileHeader, type ShowcaseItem } from '../components/ProfileHeader';
import { ProgressBar } from '../components/ProgressBar';
import { StarRating } from '../components/StarRating';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import { useUiStore } from '../store/uiStore';
import type { Album, ListenEvent, ListenSource, Track } from '../types';
import { cn } from '../utils/cn';
import {
  artistProgressRanking,
  completedAlbumTypeDistribution,
  countCompletedArtists,
  countListenedTracks,
  groupLogEvents,
  listenEventsByDay,
  listenEventsByMonth,
  listenStreak,
  listenedDurationFromEvents,
  ratingDistribution,
  ratingHabits,
  releaseYearDistribution,
  topRatedAlbums,
  topRatedArtists,
  topRelistenedTracks,
  totalListenEvents,
  totalListenedDurationMs,
} from '../utils/derive';
import { formatDayHeading, formatLongDuration } from '../utils/format';
import { useOpenAlbum, useTracksByAlbum } from '../utils/hooks';

const TABS = [
  { key: 'log', label: '로그' },
  { key: 'collection', label: '컬렉션' },
  { key: 'notes', label: '메모' },
  { key: 'stats', label: '통계' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const CHART_TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid rgba(255,255,255,0.9)',
  borderRadius: 14,
  boxShadow: '0 8px 24px -6px rgba(16,18,27,0.18)',
  fontSize: 12,
  color: '#1d1d1f',
} as const;

const AXIS_TICK = { fill: 'rgba(29,29,31,0.4)', fontSize: 10 } as const;
const CHART_CURSOR = { fill: 'rgba(29,29,31,0.05)' } as const;

/** The app's segmented control, reused by every filter on this page. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ReadonlyArray<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('glass-inset inline-flex rounded-full p-1', className)}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200',
            value === key
              ? 'bg-ink text-white shadow-sm'
              : 'text-ink/45 hover:text-ink/75',
          )}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-[22px] p-4">
      <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-ink/50">{label}</p>
    </div>
  );
}

function ChartSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="glass rounded-[22px] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-ink/70">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------

const SOURCE_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'manual', label: '수동만' },
  { key: 'spotify-sync', label: '동기화만' },
] as const;

type SourceFilter = (typeof SOURCE_OPTIONS)[number]['key'];

function LogGroupRow({
  album,
  artistName,
  events,
  tracks,
  onDelete,
}: {
  album: Album | undefined;
  artistName: string;
  events: ListenEvent[];
  tracks: Record<string, Track>;
  onDelete: (events: ListenEvent[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  // Delete is hidden behind a long press: an always-visible X next to a 40px
  // row is a mis-tap waiting to happen, and this destroys a diary entry.
  const startLongPress = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      setArmed(true);
    }, 500);
  };
  const cancelLongPress = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const single = events.length === 1;
  const title = single
    ? (tracks[events[0].trackId]?.name ?? '(삭제된 트랙)')
    : (album?.name ?? '(삭제된 앨범)');

  return (
    <div>
      <div
        className="flex items-center gap-3 p-2.5"
        onPointerDown={startLongPress}
        onPointerUp={cancelLongPress}
        onPointerMove={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setArmed(true);
        }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={single ? undefined : open}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            if (!single) setOpen((v) => !v);
          }}
        >
          {album ? (
            <CoverImage
              images={album.images}
              alt={album.name}
              sizePx={48}
              rounded="rounded-lg"
              className="w-12 shrink-0"
            />
          ) : (
            <div className="h-12 w-12 shrink-0 rounded-lg bg-ink/[0.06]" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{title}</p>
            <p className="truncate text-xs text-ink/45">
              {single ? (album?.name ?? artistName) : artistName}
            </p>
          </div>
          {!single && (
            <>
              <span className="shrink-0 rounded-full bg-ink/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/55">
                {events.length}곡
              </span>
              <ChevronDownIcon
                size={15}
                className={cn(
                  'shrink-0 text-ink/30 transition-transform duration-200',
                  open && 'rotate-180',
                )}
              />
            </>
          )}
        </button>
        {armed && (
          <button
            type="button"
            aria-label="기록 삭제"
            className="fade-in -my-2 shrink-0 rounded-full p-2.5 text-rose-500 hover:bg-rose-500/10"
            onClick={() => {
              setArmed(false);
              onDelete(events);
            }}
          >
            <XIcon size={15} />
          </button>
        )}
      </div>

      {open && !single && (
        <ul className="fade-in space-y-1 pb-2 pl-[4.5rem] pr-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 text-xs text-ink/55"
            >
              <span className="min-w-0 flex-1 truncate">
                {tracks[e.trackId]?.name ?? '(삭제된 트랙)'}
              </span>
              <button
                type="button"
                aria-label="이 기록만 삭제"
                className="shrink-0 rounded-full p-2 text-ink/25 hover:text-rose-500"
                onClick={() => onDelete([e])}
              >
                <XIcon size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LogTab({
  day,
  onClearDay,
}: {
  day: string | null;
  onClearDay: () => void;
}) {
  const events = useLogStore((s) => s.events);
  const removeEvents = useLogStore((s) => s.removeEvents);
  const restoreEvents = useLogStore((s) => s.restoreEvents);
  const pushToast = useUiStore((s) => s.pushToast);
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const [artistFilter, setArtistFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  const days = useMemo(() => {
    const filtered = events.filter(
      (e) =>
        (artistFilter === '' || e.artistId === artistFilter) &&
        (sourceFilter === 'all' || e.source === (sourceFilter as ListenSource)),
    );
    const grouped = groupLogEvents(filtered);
    return day ? grouped.filter((d) => d.dayKey === day) : grouped;
  }, [events, artistFilter, sourceFilter, day]);

  const trackedArtists = useMemo(() => {
    const seen = new Set(events.map((e) => e.artistId));
    return Object.values(artists)
      .filter((a) => seen.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [artists, events]);

  const onDelete = async (removed: ListenEvent[]) => {
    await removeEvents(removed.map((e) => e.id));
    pushToast(
      removed.length === 1 ? '기록을 삭제했어요' : `${removed.length}개 기록 삭제`,
      {
        action: {
          label: '실행 취소',
          // Only the diary entry is restored; the track's status is deliberately
          // left alone. Deleting one occurrence is not the same as declaring
          // the track unheard, and other events for it may still exist.
          onClick: () => void restoreEvents(removed),
        },
      },
    );
  };

  const filtering = artistFilter !== '' || sourceFilter !== 'all' || day != null;

  return (
    <div>
      {day && (
        <button
          type="button"
          className="glass-inset mb-3 inline-flex items-center gap-2 rounded-full py-2 pl-4 pr-3 text-sm font-semibold text-ink/70"
          onClick={onClearDay}
        >
          {formatDayHeading(day)}
          <XIcon size={13} />
        </button>
      )}
      <ArtistFilterChips
        artists={trackedArtists}
        value={artistFilter}
        onChange={setArtistFilter}
        allLabel="모든 아티스트"
        className="mb-3"
      />
      <Segmented
        options={SOURCE_OPTIONS}
        value={sourceFilter}
        onChange={setSourceFilter}
        className="mb-4"
      />

      {days.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink/40">
          {filtering ? '조건에 맞는 기록이 없어요' : '아직 청취 기록이 없어요'}
        </p>
      ) : (
        <div className="space-y-6">
          {days.map(({ dayKey, groups }) => (
            <section key={dayKey}>
              <h3 className="mb-2 text-xs font-bold text-ink/45">
                {formatDayHeading(dayKey)}
              </h3>
              <div className="glass divide-y divide-ink/[0.07] overflow-hidden rounded-[22px]">
                {groups.map((group) => (
                  <LogGroupRow
                    key={group.events[0].id}
                    album={albums[group.albumId]}
                    artistName={artists[group.artistId]?.name ?? ''}
                    events={group.events}
                    tracks={tracks}
                    onDelete={(list) => void onDelete(list)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

const KIND_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'album', label: '앨범만' },
  { key: 'track', label: '트랙만' },
] as const;

const MIN_RATING_OPTIONS = [
  { key: 'any', label: '전체' },
  { key: '4', label: '4.0+' },
  { key: '4.5', label: '4.5+' },
  { key: '5', label: '5.0' },
] as const;

function CollectionTab() {
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const artists = useArtistStore((s) => s.artists);
  const openAlbum = useOpenAlbum();
  const [mode, setMode] = useState<'liked' | 'rated'>('liked');
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]['key']>('all');
  const [minRating, setMinRating] =
    useState<(typeof MIN_RATING_OPTIONS)[number]['key']>('any');
  const [artistFilter, setArtistFilter] = useState('');

  const albumList = useMemo(() => Object.values(albums), [albums]);
  const trackList = useMemo(() => Object.values(tracks), [tracks]);

  const collectedArtists = useMemo(() => {
    const seen = new Set<string>();
    for (const al of albumList) {
      if (al.likedAt || al.rating != null) seen.add(al.artistId);
    }
    for (const t of trackList) {
      if (t.likedAt || t.rating != null) seen.add(t.artistId);
    }
    return Object.values(artists)
      .filter((a) => seen.has(a.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [albumList, trackList, artists]);

  const items = useMemo(() => {
    interface Item {
      key: string;
      album: Album | undefined;
      track: Track | undefined;
      artistId: string;
      sort: string | number;
      rating?: number;
    }
    const floor = minRating === 'any' ? 0 : Number(minRating);
    const out: Item[] = [];
    const wantAlbums = kind !== 'track';
    const wantTracks = kind !== 'album';

    if (mode === 'liked') {
      if (wantAlbums) {
        for (const al of albumList) {
          if (!al.likedAt) continue;
          out.push({
            key: `al-${al.id}`,
            album: al,
            track: undefined,
            artistId: al.artistId,
            sort: al.likedAt,
            rating: al.rating,
          });
        }
      }
      if (wantTracks) {
        for (const t of trackList) {
          if (!t.likedAt) continue;
          out.push({
            key: `tr-${t.id}`,
            album: albums[t.albumId],
            track: t,
            artistId: t.artistId,
            sort: t.likedAt,
            rating: t.rating,
          });
        }
      }
      out.sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
    } else {
      if (wantAlbums) {
        for (const al of albumList) {
          if (al.rating == null || al.rating < floor) continue;
          out.push({
            key: `al-${al.id}`,
            album: al,
            track: undefined,
            artistId: al.artistId,
            sort: al.rating,
            rating: al.rating,
          });
        }
      }
      if (wantTracks) {
        for (const t of trackList) {
          if (t.rating == null || t.rating < floor) continue;
          out.push({
            key: `tr-${t.id}`,
            album: albums[t.albumId],
            track: t,
            artistId: t.artistId,
            sort: t.rating,
            rating: t.rating,
          });
        }
      }
      // Name tiebreak so equal ratings stop reshuffling between renders.
      out.sort(
        (a, b) =>
          Number(b.sort) - Number(a.sort) ||
          (a.track?.name ?? a.album?.name ?? '').localeCompare(
            b.track?.name ?? b.album?.name ?? '',
            'ko',
          ),
      );
    }
    return artistFilter === ''
      ? out
      : out.filter((i) => i.artistId === artistFilter);
  }, [mode, kind, minRating, artistFilter, albumList, trackList, albums]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          options={
            [
              { key: 'liked', label: '좋아요' },
              { key: 'rated', label: '평점' },
            ] as const
          }
          value={mode}
          onChange={setMode}
        />
        <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
        {mode === 'rated' && (
          <Segmented
            options={MIN_RATING_OPTIONS}
            value={minRating}
            onChange={setMinRating}
          />
        )}
      </div>

      <ArtistFilterChips
        artists={collectedArtists}
        value={artistFilter}
        onChange={setArtistFilter}
        allLabel="모든 아티스트"
        className="mb-4"
      />

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink/40">
          {mode === 'liked' ? '좋아요한 항목이 없어요' : '조건에 맞는 항목이 없어요'}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => {
            const targetAlbumId = item.album?.id ?? item.track?.albumId;
            const name = item.track?.name ?? item.album?.name ?? '';
            const sub = artists[item.artistId]?.name ?? '';
            return (
              <button
                key={item.key}
                type="button"
                className="text-left transition-transform duration-150 active:scale-95"
                onClick={() => targetAlbumId && openAlbum(targetAlbumId)}
              >
                {item.album ? (
                  <CoverImage
                    images={item.album.images}
                    alt={name}
                    sizePx={120}
                    className="w-full shadow-md"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-xl bg-ink/[0.06]" />
                )}
                <p className="mt-1.5 truncate text-xs font-medium text-ink/80">
                  {name}
                </p>
                <p className="truncate text-[11px] text-ink/40">
                  {item.track ? `${sub} · 트랙` : sub}
                </p>
                {item.rating != null && (
                  <StarRating
                    size={14}
                    value={item.rating}
                    readOnly
                    className="mt-0.5"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function NotesTab() {
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const artists = useArtistStore((s) => s.artists);
  const events = useLogStore((s) => s.events);
  const openAlbum = useOpenAlbum();
  const [query, setQuery] = useState('');

  const notes = useMemo(() => {
    // Notes carry no timestamp of their own, so the most recent listen of the
    // thing they describe stands in for "recent".
    const lastTouch = new Map<string, string>();
    for (const e of events) {
      const prevAlbum = lastTouch.get(`al-${e.albumId}`);
      if (!prevAlbum || e.listenedAt > prevAlbum) {
        lastTouch.set(`al-${e.albumId}`, e.listenedAt);
      }
      const prevTrack = lastTouch.get(`tr-${e.trackId}`);
      if (!prevTrack || e.listenedAt > prevTrack) {
        lastTouch.set(`tr-${e.trackId}`, e.listenedAt);
      }
    }
    interface NoteItem {
      key: string;
      albumId: string;
      title: string;
      subtitle: string;
      note: string;
      images: Album['images'];
      sort: string;
    }
    const out: NoteItem[] = [];
    for (const al of Object.values(albums)) {
      if (!al.note) continue;
      out.push({
        key: `al-${al.id}`,
        albumId: al.id,
        title: al.name,
        subtitle: artists[al.artistId]?.name ?? '',
        note: al.note,
        images: al.images,
        sort: lastTouch.get(`al-${al.id}`) ?? '',
      });
    }
    for (const t of Object.values(tracks)) {
      if (!t.note) continue;
      const album = albums[t.albumId];
      out.push({
        key: `tr-${t.id}`,
        albumId: t.albumId,
        title: t.name,
        subtitle: [artists[t.artistId]?.name, album?.name]
          .filter(Boolean)
          .join(' · '),
        note: t.note,
        images: album?.images ?? [],
        sort: lastTouch.get(`tr-${t.id}`) ?? '',
      });
    }
    const q = query.trim().toLowerCase();
    return out
      .filter(
        (n) =>
          q === '' ||
          n.note.toLowerCase().includes(q) ||
          n.title.toLowerCase().includes(q) ||
          n.subtitle.toLowerCase().includes(q),
      )
      .sort((a, b) => b.sort.localeCompare(a.sort) || a.title.localeCompare(b.title, 'ko'));
  }, [albums, tracks, artists, events, query]);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="메모 검색"
        className="glass-inset mb-4 w-full rounded-[18px] px-4 py-2.5 text-sm text-ink placeholder-ink/30 outline-none focus:ring-2 focus:ring-ink/15"
      />
      {notes.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink/40">
          {query.trim() === ''
            ? '아직 메모가 없어요. 앨범이나 트랙에 메모를 남겨보세요.'
            : '검색 결과가 없어요'}
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <button
              key={n.key}
              type="button"
              className="glass flex w-full items-start gap-3 rounded-[18px] p-3 text-left transition-transform active:scale-[0.99]"
              onClick={() => openAlbum(n.albumId)}
            >
              {n.images.length > 0 ? (
                <CoverImage
                  images={n.images}
                  alt={n.title}
                  sizePx={40}
                  rounded="rounded-lg"
                  className="w-10 shrink-0"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-lg bg-ink/[0.06]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{n.title}</p>
                <p className="truncate text-xs text-ink/45">{n.subtitle}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-ink/65">
                  {n.note}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const PERIOD_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'year', label: '올해' },
  { key: '30d', label: '최근 30일' },
] as const;

type Period = (typeof PERIOD_OPTIONS)[number]['key'];

function periodStart(period: Period, now: Date): string | null {
  if (period === 'all') return null;
  if (period === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 29,
  ).toISOString();
}

function StatsTab({ onSelectDay }: { onSelectDay: (day: string) => void }) {
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const events = useLogStore((s) => s.events);
  const tracksByAlbum = useTracksByAlbum();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('all');
  const [ratingMode, setRatingMode] = useState<'track' | 'album'>('track');

  const stats = useMemo(() => {
    const now = new Date();
    const artistList = Object.values(artists);
    const albumList = Object.values(albums);
    const trackList = Object.values(tracks);
    const start = periodStart(period, now);
    const scoped = start ? events.filter((e) => e.listenedAt >= start) : events;

    // Every derive helper is pure, so scoping is just a different array.
    const months =
      period === '30d' ? 2 : period === 'year' ? now.getMonth() + 1 : 12;
    const heatmapDays = period === '30d' ? 30 : period === 'year' ? 365 : 365;

    const listenedTracks =
      period === 'all'
        ? countListenedTracks(trackList)
        : new Set(scoped.map((e) => e.trackId)).size;
    const durationMs =
      period === 'all'
        ? totalListenedDurationMs(trackList)
        : listenedDurationFromEvents(scoped, tracks);

    return {
      completed: countCompletedArtists(artistList, albumList, tracksByAlbum),
      listenedTracks,
      durationMs,
      totalEvents: totalListenEvents(scoped),
      // Streaks read "as of now", so the current one always spans all history.
      currentStreak: listenStreak(events, now).current,
      longestStreak: listenStreak(scoped, now).longest,
      byDay: listenEventsByDay(scoped, heatmapDays, now),
      byMonth: listenEventsByMonth(scoped, months, now),
      trackRatings: ratingDistribution(trackList),
      albumRatings: ratingDistribution(albumList),
      releaseYears: releaseYearDistribution(albumList, tracksByAlbum),
      ranking: artistProgressRanking(artistList, albumList, tracksByAlbum, 5),
      albumTypes: completedAlbumTypeDistribution(albumList, tracksByAlbum),
      habits: ratingHabits(trackList),
      relistened: topRelistenedTracks(scoped, tracks, 5),
    };
  }, [artists, albums, tracks, events, tracksByAlbum, period]);

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const maxType = Math.max(...stats.albumTypes.map((t) => t.count), 1);

  return (
    <div className="space-y-6">
      <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="완주 아티스트" value={stats.completed} />
        <StatCard label="청취한 트랙" value={stats.listenedTracks} />
        <StatCard
          label="총 청취 시간"
          value={formatLongDuration(stats.durationMs)}
        />
        <StatCard label="현재 연속일" value={stats.currentStreak} />
        <StatCard label="최장 연속일" value={stats.longestStreak} />
        <StatCard label="청취 이벤트" value={stats.totalEvents} />
      </div>

      <ChartSection title="청취 히트맵">
        <ListenHeatmap days={stats.byDay} onSelectDay={onSelectDay} />
      </ChartSection>

      <ChartSection title="월별 청취">
        <ResponsiveContainer width="100%" height={170}>
          <BarChart
            data={stats.byMonth}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="month"
              tick={AXIS_TICK}
              tickFormatter={(m: string) => m.slice(5)}
              axisLine={false}
              tickLine={false}
              interval={stats.byMonth.length > 6 ? 1 : 0}
            />
            <YAxis hide />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
            <Bar
              dataKey="count"
              name="청취"
              fill="#fa2d48"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {stats.releaseYears.length > 0 && (
        <ChartSection title="발매연도 분포">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={stats.releaseYears}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="bucket"
                tick={AXIS_TICK}
                tickFormatter={(b: string) => b.slice(0, 4)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
              <Bar
                dataKey="count"
                name="앨범"
                fill="#118ab2"
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* Albums and tracks used to share one histogram, where tracks outnumber
          albums by an order of magnitude and buried them entirely. */}
      <ChartSection
        title="평점 분포"
        action={
          <Segmented
            options={
              [
                { key: 'track', label: '트랙' },
                { key: 'album', label: '앨범' },
              ] as const
            }
            value={ratingMode}
            onChange={setRatingMode}
          />
        }
      >
        <ResponsiveContainer width="100%" height={150}>
          <BarChart
            data={ratingMode === 'track' ? stats.trackRatings : stats.albumRatings}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis dataKey="rating" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR} />
            <Bar
              dataKey="count"
              name="개수"
              fill="#f59e0b"
              radius={[5, 5, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartSection>

      {stats.ranking.length > 0 && (
        <ChartSection title="완주까지">
          <ul className="space-y-3">
            {stats.ranking.map((r) => (
              <li key={r.artist.id}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => navigate(`/artist/${r.artist.id}`)}
                >
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.artist.name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-ink/50">
                      완주까지 {r.remaining}곡
                    </span>
                  </div>
                  <ProgressBar value={r.ratio} />
                </button>
              </li>
            ))}
          </ul>
        </ChartSection>
      )}

      <ChartSection title="완주한 앨범 종류">
        <div className="space-y-2">
          {stats.albumTypes.map((t) => (
            <div key={t.label} className="flex items-center gap-2.5">
              <span className="w-20 shrink-0 text-xs text-ink/60">{t.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                <div
                  className="h-full rounded-full bg-sky-500/70"
                  style={{ width: `${(t.count / maxType) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink/40">
                {t.count}
              </span>
            </div>
          ))}
        </div>
      </ChartSection>

      <ChartSection title="평가 습관">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="평균 별점"
            value={stats.habits.averageRating?.toFixed(2) ?? '—'}
          />
          <StatCard label="평가율" value={pct(stats.habits.ratedShare)} />
          <StatCard label="좋아요율" value={pct(stats.habits.likedShare)} />
          <StatCard label="스킵율" value={pct(stats.habits.skippedShare)} />
        </div>
      </ChartSection>

      {stats.relistened.length > 0 && (
        <ChartSection title="최다 재청취">
          <ol className="space-y-2">
            {stats.relistened.map(({ track, count }, i) => (
              <li key={track.id} className="flex items-center gap-3 text-sm">
                <span className="w-5 shrink-0 text-center font-bold text-ink/25">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{track.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink/45">
                  {count}회
                </span>
              </li>
            ))}
          </ol>
        </ChartSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'log';

  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const tracksByAlbum = useTracksByAlbum();
  const openAlbum = useOpenAlbum();
  const navigate = useNavigate();

  const header = useMemo(() => {
    const artistList = Object.values(artists);
    const albumList = Object.values(albums);
    const trackList = Object.values(tracks);
    const showcase: ShowcaseItem[] = [
      ...topRatedArtists(artistList, albumList, trackList, 5).map((r) => ({
        key: `artist-${r.item.id}`,
        name: r.item.name,
        images: r.item.images,
        rating: r.rating,
        kind: 'artist' as const,
        linkTo: `/artist/${r.item.id}`,
      })),
      ...topRatedAlbums(albumList, 5).map((r) => ({
        key: `album-${r.item.id}`,
        name: r.item.name,
        images: r.item.images,
        rating: r.rating,
        kind: 'album' as const,
        linkTo: `/album/${r.item.id}`,
      })),
    ]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 10);
    return {
      totalListenedTracks: countListenedTracks(trackList),
      completedArtistCount: countCompletedArtists(artistList, albumList, tracksByAlbum),
      showcase,
    };
  }, [artists, albums, tracks, tracksByAlbum]);

  return (
    <div>
      <h1 className="mb-4 text-[28px] font-bold tracking-tight">프로필</h1>

      <ProfileHeader
        totalListenedTracks={header.totalListenedTracks}
        completedArtistCount={header.completedArtistCount}
        showcase={header.showcase}
        onShowcaseItemClick={(item) => {
          if (item.kind === 'album') {
            openAlbum(item.key.replace('album-', ''));
          } else if (item.linkTo) {
            navigate(item.linkTo);
          }
        }}
      />

      <div className="glass-inset mb-5 inline-flex rounded-full p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200',
              tab === key
                ? 'bg-ink text-white shadow-sm'
                : 'text-ink/45 hover:text-ink/75',
            )}
            // replace: tab switching should not stack history entries the
            // back gesture has to chew through.
            onClick={() => setSearchParams({ tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' && (
        <LogTab
          day={searchParams.get('day')}
          onClearDay={() => setSearchParams({ tab: 'log' }, { replace: true })}
        />
      )}
      {tab === 'collection' && <CollectionTab />}
      {tab === 'notes' && <NotesTab />}
      {tab === 'stats' && (
        <StatsTab
          onSelectDay={(day) => {
            // Heatmap cells jump to that day's diary.
            setSearchParams({ tab: 'log', day }, { replace: true });
          }}
        />
      )}
    </div>
  );
}
