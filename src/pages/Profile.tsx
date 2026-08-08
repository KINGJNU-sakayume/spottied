import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CoverImage } from '../components/CoverImage';
import { PencilIcon, RefreshIcon, XIcon } from '../components/Icons';
import { ProfileHeader, type ShowcaseItem } from '../components/ProfileHeader';
import { StarRating } from '../components/StarRating';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import type { Album, Track } from '../types';
import { cn } from '../utils/cn';
import {
  countCompletedArtists,
  countListenedTracks,
  genreDistribution,
  listenEventsByMonth,
  listenStreak,
  ratingDistribution,
  topRatedAlbums,
  topRatedArtists,
  topRelistenedTracks,
  totalListenEvents,
} from '../utils/derive';
import { formatDayHeading, formatTime, localDayKey } from '../utils/format';
import { useOpenAlbum, useTracksByAlbum } from '../utils/hooks';

const TABS = [
  { key: 'log', label: '로그' },
  { key: 'collection', label: '컬렉션' },
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

function LogTab() {
  const events = useLogStore((s) => s.events);
  const removeEvent = useLogStore((s) => s.removeEvent);
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const [artistFilter, setArtistFilter] = useState('');

  const grouped = useMemo(() => {
    const filtered = events
      .filter((e) => artistFilter === '' || e.artistId === artistFilter)
      .sort((a, b) => b.listenedAt.localeCompare(a.listenedAt));
    const byDay = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const key = localDayKey(e.listenedAt);
      const list = byDay.get(key) ?? [];
      list.push(e);
      byDay.set(key, list);
    }
    return [...byDay.entries()];
  }, [events, artistFilter]);

  const trackedArtists = useMemo(
    () =>
      Object.values(artists).sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [artists],
  );

  return (
    <div>
      <select
        value={artistFilter}
        onChange={(e) => setArtistFilter(e.target.value)}
        className="glass-inset mb-4 w-full appearance-none rounded-[18px] px-4 py-2.5 text-sm font-medium outline-none"
      >
        <option value="">모든 아티스트</option>
        {trackedArtists.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      {grouped.length === 0 && (
        <p className="py-16 text-center text-sm text-ink/40">
          아직 청취 기록이 없어요
        </p>
      )}

      <div className="space-y-6">
        {grouped.map(([day, dayEvents]) => (
          <section key={day}>
            <h3 className="mb-2 text-xs font-bold text-ink/45">
              {formatDayHeading(day)}
            </h3>
            <div className="glass divide-y divide-ink/[0.07] rounded-[22px]">
              {dayEvents.map((e) => {
                const track = tracks[e.trackId];
                const album = albums[e.albumId];
                const artist = artists[e.artistId];
                return (
                  <div key={e.id} className="flex items-center gap-3 p-2.5">
                    {album ? (
                      <CoverImage
                        images={album.images}
                        alt={album.name}
                        sizePx={40}
                        rounded="rounded-lg"
                        className="w-10 shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 shrink-0 rounded-lg bg-ink/[0.06]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {track?.name ?? '(삭제된 트랙)'}
                      </p>
                      <p className="truncate text-xs text-ink/45">
                        {artist?.name ?? ''}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-ink/30"
                      title={e.source === 'manual' ? '수동 기록' : 'Spotify 동기화'}
                    >
                      {e.source === 'manual' ? (
                        <PencilIcon size={13} />
                      ) : (
                        <RefreshIcon size={13} />
                      )}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink/40">
                      {formatTime(e.listenedAt)}
                    </span>
                    <button
                      type="button"
                      aria-label="기록 삭제"
                      className="shrink-0 p-1 text-ink/20 hover:text-ink/60"
                      onClick={() => void removeEvent(e.id)}
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CollectionTab() {
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const artists = useArtistStore((s) => s.artists);
  const openAlbum = useOpenAlbum();
  const [mode, setMode] = useState<'liked' | 'rated'>('liked');

  const albumList = useMemo(() => Object.values(albums), [albums]);
  const trackList = useMemo(() => Object.values(tracks), [tracks]);

  const items = useMemo(() => {
    type Item = {
      key: string;
      album: Album | undefined;
      track: Track | undefined;
      sort: string | number;
      rating?: number;
    };
    const out: Item[] = [];
    if (mode === 'liked') {
      for (const al of albumList) {
        if (al.likedAt) {
          out.push({ key: `al-${al.id}`, album: al, track: undefined, sort: al.likedAt });
        }
      }
      for (const t of trackList) {
        if (t.likedAt) {
          out.push({
            key: `tr-${t.id}`,
            album: albums[t.albumId],
            track: t,
            sort: t.likedAt,
          });
        }
      }
      out.sort((a, b) => String(b.sort).localeCompare(String(a.sort)));
    } else {
      for (const al of albumList) {
        if (al.rating != null) {
          out.push({
            key: `al-${al.id}`,
            album: al,
            track: undefined,
            sort: al.rating,
            rating: al.rating,
          });
        }
      }
      for (const t of trackList) {
        if (t.rating != null) {
          out.push({
            key: `tr-${t.id}`,
            album: albums[t.albumId],
            track: t,
            sort: t.rating,
            rating: t.rating,
          });
        }
      }
      out.sort((a, b) => Number(b.sort) - Number(a.sort));
    }
    return out;
  }, [mode, albumList, trackList, albums]);

  return (
    <div>
      <div className="glass-inset mb-4 inline-flex rounded-full p-1">
        {(
          [
            { key: 'liked', label: '좋아요' },
            { key: 'rated', label: '평점' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200',
              mode === key
                ? 'bg-ink text-white shadow-sm'
                : 'text-ink/45 hover:text-ink/75',
            )}
            onClick={() => setMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <p className="py-16 text-center text-sm text-ink/40">
          {mode === 'liked' ? '좋아요한 항목이 없어요' : '평가한 항목이 없어요'}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        {items.map((item) => {
          const targetAlbumId = item.album?.id ?? item.track?.albumId;
          const name = item.track?.name ?? item.album?.name ?? '';
          const sub = item.track
            ? (artists[item.track.artistId]?.name ?? '')
            : (item.album && artists[item.album.artistId]?.name) || '';
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
              <p className="mt-1.5 truncate text-xs font-medium text-ink/80">{name}</p>
              <p className="truncate text-[11px] text-ink/40">
                {item.track ? `${sub} · 트랙` : sub}
              </p>
              {item.rating != null && (
                <StarRating size={9} value={item.rating} readOnly className="mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatsTab() {
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const events = useLogStore((s) => s.events);
  const tracksByAlbum = useTracksByAlbum();

  const stats = useMemo(() => {
    const artistList = Object.values(artists);
    const albumList = Object.values(albums);
    const trackList = Object.values(tracks);
    return {
      completed: countCompletedArtists(artistList, albumList, tracksByAlbum),
      listenedTracks: countListenedTracks(trackList),
      totalEvents: totalListenEvents(events),
      streak: listenStreak(events),
      byMonth: listenEventsByMonth(events),
      ratings: ratingDistribution([...trackList, ...albumList]),
      genres: genreDistribution(artistList).slice(0, 8),
      relistened: topRelistenedTracks(events, tracks, 5),
    };
  }, [artists, albums, tracks, events, tracksByAlbum]);

  const maxGenre = stats.genres[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '완주 아티스트', value: stats.completed },
          { label: '청취한 트랙', value: stats.listenedTracks },
          { label: '청취 이벤트', value: stats.totalEvents },
          { label: '최장 연속 청취일', value: stats.streak.longest },
        ].map(({ label, value }) => (
          <div key={label} className="glass rounded-[22px] p-4">
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-0.5 text-xs text-ink/50">{label}</p>
          </div>
        ))}
      </div>

      <section className="glass rounded-[22px] p-4">
        <h3 className="mb-3 text-sm font-bold text-ink/70">월별 청취</h3>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={stats.byMonth} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="month"
              tick={AXIS_TICK}
              tickFormatter={(m: string) => m.slice(5)}
              axisLine={false}
              tickLine={false}
              interval={1}
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
      </section>

      <section className="glass rounded-[22px] p-4">
        <h3 className="mb-3 text-sm font-bold text-ink/70">평점 분포</h3>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart
            data={stats.ratings}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <XAxis
              dataKey="rating"
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
            />
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
      </section>

      {stats.genres.length > 0 && (
        <section className="glass rounded-[22px] p-4">
          <h3 className="mb-3 text-sm font-bold text-ink/70">장르 분포</h3>
          <div className="space-y-2">
            {stats.genres.map((g) => (
              <div key={g.genre} className="flex items-center gap-2.5">
                <span className="w-28 shrink-0 truncate text-xs text-ink/60">
                  {g.genre}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.08]">
                  <div
                    className="h-full rounded-full bg-rose-500/80"
                    style={{ width: `${(g.count / maxGenre) * 100}%` }}
                  />
                </div>
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink/40">
                  {g.count}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.relistened.length > 0 && (
        <section className="glass rounded-[22px] p-4">
          <h3 className="mb-3 text-sm font-bold text-ink/70">최다 재청취</h3>
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
        </section>
      )}
    </div>
  );
}

export default function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : 'log';

  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const tracks = useArtistStore((s) => s.tracks);
  const tracksByAlbum = useTracksByAlbum();
  const openAlbum = useOpenAlbum();

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
            window.location.hash = `#${item.linkTo}`;
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
            onClick={() => setSearchParams({ tab: key })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' && <LogTab />}
      {tab === 'collection' && <CollectionTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  );
}
