import type {
  Album,
  Artist,
  ArtistDigStatus,
  ListenEvent,
  Track,
} from '../types';
// format.ts is dependency-free, so importing it keeps derive.ts pure.
import { dayKeyOf, localDayKey } from './format';

export type TracksByAlbum = Record<string, Track[]>;

/** Normalizes possibly year-only / year-month release dates into a sortable key. */
export function releaseDateKey(releaseDate: string): string {
  const [y = '0000', m = '01', d = '01'] = releaseDate.split('-');
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function sortAlbumsByRelease(albums: Album[]): Album[] {
  return [...albums].sort(
    (a, b) =>
      releaseDateKey(a.releaseDate).localeCompare(releaseDateKey(b.releaseDate)) ||
      a.name.localeCompare(b.name),
  );
}

export function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort(
    (a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber,
  );
}

export function isProcessed(track: Track): boolean {
  return track.status !== 'none';
}

/** Spotify's `single` group mixes singles and EPs; classify for display only. */
export function getAlbumTypeLabel(album: Album): string {
  switch (album.albumGroup) {
    case 'album':
      return '정규';
    case 'compilation':
      return '컴필레이션';
    case 'single':
      return album.totalTracks >= 4 ? 'EP' : '싱글';
  }
}

export function getInScopeAlbums(artist: Artist, albums: Album[]): Album[] {
  return sortAlbumsByRelease(
    albums.filter(
      (al) =>
        al.artistId === artist.id && !al.excluded && artist.scope[al.albumGroup],
    ),
  );
}

export interface AlbumProgress {
  processed: number;
  total: number;
  ratio: number;
  complete: boolean;
  tracksKnown: boolean;
}

export function getAlbumProgress(album: Album, tracks: Track[]): AlbumProgress {
  const tracksKnown = tracks.length > 0;
  const total = tracksKnown ? tracks.length : Math.max(album.totalTracks, 0);
  const processed = tracks.filter(isProcessed).length;
  const complete =
    (tracksKnown && processed >= total) || (!tracksKnown && total === 0);
  return {
    processed,
    total,
    ratio: total > 0 ? processed / total : complete ? 1 : 0,
    complete,
    tracksKnown,
  };
}

export function getArtistStatus(
  artist: Artist,
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
): ArtistDigStatus {
  const inScope = getInScopeAlbums(artist, albums);
  const complete =
    inScope.length > 0 &&
    inScope.every((al) => getAlbumProgress(al, tracksByAlbum[al.id] ?? []).complete);
  if (complete) return 'completed';
  const anyProcessed = albums.some(
    (al) =>
      al.artistId === artist.id &&
      (tracksByAlbum[al.id] ?? []).some(isProcessed),
  );
  return anyProcessed ? 'in-progress' : 'not-started';
}

export const ARTIST_STATUS_LABEL: Record<ArtistDigStatus, string> = {
  'not-started': '미시작',
  'in-progress': '진행 중',
  completed: '완주',
};

export interface ArtistProgress {
  processed: number;
  total: number;
  ratio: number;
}

export function getArtistProgress(
  artist: Artist,
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
): ArtistProgress {
  let processed = 0;
  let total = 0;
  for (const al of getInScopeAlbums(artist, albums)) {
    const p = getAlbumProgress(al, tracksByAlbum[al.id] ?? []);
    processed += p.processed;
    total += p.total;
  }
  return { processed, total, ratio: total > 0 ? processed / total : 0 };
}

export interface ResumePoint {
  album: Album;
  albumIndex: number; // 0-based index within in-scope albums
  albumCount: number;
  track: Track | null; // null when the album's tracks are not cached yet
}

/**
 * The first unprocessed track, walking in-scope albums in release-date
 * ascending order, tracks in disc/track order.
 */
export function getResumePoint(
  artist: Artist,
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
): ResumePoint | null {
  const inScope = getInScopeAlbums(artist, albums);
  for (let i = 0; i < inScope.length; i++) {
    const album = inScope[i];
    const tracks = tracksByAlbum[album.id] ?? [];
    if (tracks.length === 0) {
      if (album.totalTracks === 0) continue;
      return { album, albumIndex: i, albumCount: inScope.length, track: null };
    }
    const next = sortTracks(tracks).find((t) => !isProcessed(t));
    if (next) {
      return { album, albumIndex: i, albumCount: inScope.length, track: next };
    }
  }
  return null;
}

export function formatResumeText(rp: ResumePoint): string {
  const albumPart = `${rp.albumIndex + 1}번째 앨범`;
  return rp.track
    ? `${albumPart} · ${rp.track.trackNumber}. ${rp.track.name}`
    : `${albumPart} · ${rp.album.name}`;
}

// ---------------------------------------------------------------------------
// Stats (all pure — the v2 achievement engine will evaluate over these too)
// ---------------------------------------------------------------------------

export function countCompletedArtists(
  artists: Artist[],
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
): number {
  return artists.filter(
    (a) => getArtistStatus(a, albums, tracksByAlbum) === 'completed',
  ).length;
}

export function totalListenEvents(events: ListenEvent[]): number {
  return events.length;
}

export function countListenedTracks(tracks: Track[]): number {
  return tracks.filter((t) => t.status === 'listened').length;
}

export interface MonthCount {
  month: string; // e.g. "2026.03"
  count: number;
}

export function listenEventsByMonth(
  events: ListenEvent[],
  months = 12,
  now: Date = new Date(),
): MonthCount[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const d = new Date(e.listenedAt);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: MonthCount[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

export interface RatingBucket {
  rating: number;
  count: number;
}

export function ratingDistribution(items: Array<{ rating?: number }>): RatingBucket[] {
  const buckets: RatingBucket[] = [];
  for (let r = 0.5; r <= 5; r += 0.5) {
    buckets.push({ rating: r, count: 0 });
  }
  for (const item of items) {
    if (item.rating == null) continue;
    const idx = Math.round(item.rating * 2) - 1;
    if (idx >= 0 && idx < buckets.length) buckets[idx].count += 1;
  }
  return buckets;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export function genreDistribution(artists: Artist[]): GenreCount[] {
  const counts = new Map<string, number>();
  for (const a of artists) {
    // genres is deprecated upstream, so rows imported later may lack it.
    for (const g of a.genres ?? []) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
}

export function distinctGenres(artists: Artist[]): string[] {
  return genreDistribution(artists).map((g) => g.genre);
}

export interface RelistenedTrack {
  track: Track;
  count: number;
}

export function topRelistenedTracks(
  events: ListenEvent[],
  tracksById: Record<string, Track>,
  limit = 10,
): RelistenedTrack[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.trackId, (counts.get(e.trackId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([id, count]) => count >= 2 && tracksById[id] != null)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ track: tracksById[id], count }));
}

export interface ListenStreak {
  current: number; // consecutive days ending today (or yesterday)
  longest: number;
}

export function listenStreak(
  events: ListenEvent[],
  now: Date = new Date(),
): ListenStreak {
  const days = [...new Set(events.map((e) => localDayKey(e.listenedAt)))].sort();
  if (days.length === 0) return { current: 0, longest: 0 };

  const dayMs = 24 * 60 * 60 * 1000;
  const toTime = (key: string) => new Date(`${key}T00:00:00`).getTime();

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    if (toTime(days[i]) - toTime(days[i - 1]) === dayMs) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  const todayKey = localDayKey(now.toISOString());
  const last = days[days.length - 1];
  const gap = Math.round((toTime(todayKey) - toTime(last)) / dayMs);
  const current = gap <= 1 ? run : 0;
  return { current, longest };
}

export interface RatedItem<T> {
  item: T;
  rating: number;
}

export function topRatedAlbums(albums: Album[], limit = 10): RatedItem<Album>[] {
  return albums
    .filter((a): a is Album & { rating: number } => a.rating != null)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit)
    .map((a) => ({ item: a, rating: a.rating }));
}

/** Artists ranked by the mean rating of their rated albums and tracks. */
export function topRatedArtists(
  artists: Artist[],
  albums: Album[],
  tracks: Track[],
  limit = 10,
): RatedItem<Artist>[] {
  const sums = new Map<string, { sum: number; n: number }>();
  const push = (artistId: string, rating?: number) => {
    if (rating == null) return;
    const cur = sums.get(artistId) ?? { sum: 0, n: 0 };
    cur.sum += rating;
    cur.n += 1;
    sums.set(artistId, cur);
  };
  for (const al of albums) push(al.artistId, al.rating);
  for (const t of tracks) push(t.artistId, t.rating);
  return artists
    .map((a) => {
      const s = sums.get(a.id);
      return s ? { item: a, rating: s.sum / s.n } : null;
    })
    .filter((x): x is RatedItem<Artist> => x != null)
    // Ties are common (everything at 5.0 early on); without the name tiebreak
    // the order follows object insertion and shifts between reloads.
    .sort(
      (a, b) =>
        b.rating - a.rating || a.item.name.localeCompare(b.item.name, 'ko'),
    )
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export interface AlbumYearGroup {
  year: string; // 'YYYY'
  albums: Album[];
}

/** Discography timeline bucketed by release year, oldest year first. */
export function groupAlbumsByYear(albums: Album[]): AlbumYearGroup[] {
  const byYear = new Map<string, Album[]>();
  // Sorting first means Map insertion order is already ascending by year.
  for (const album of sortAlbumsByRelease(albums)) {
    const year = releaseDateKey(album.releaseDate).slice(0, 4);
    const list = byYear.get(year);
    if (list) list.push(album);
    else byYear.set(year, [album]);
  }
  return [...byYear.entries()].map(([year, list]) => ({ year, albums: list }));
}

export interface LogGroup {
  dayKey: string;
  albumId: string;
  artistId: string;
  events: ListenEvent[]; // newest-first
}

export interface LogDay {
  dayKey: string;
  groups: LogGroup[];
}

/**
 * Diary feed: newest-first, split by local calendar day, with *consecutive*
 * plays of the same album folded into one row so finishing an album does not
 * print twelve identical covers.
 */
export function groupLogEvents(events: ListenEvent[]): LogDay[] {
  const sorted = [...events].sort(
    // `markAlbumListened` stamps every event it creates with one identical
    // timestamp, so the id tiebreak is what makes the order reproducible.
    (a, b) =>
      b.listenedAt.localeCompare(a.listenedAt) || a.id.localeCompare(b.id),
  );
  const days: LogDay[] = [];
  for (const event of sorted) {
    const dayKey = localDayKey(event.listenedAt);
    let day = days[days.length - 1];
    if (!day || day.dayKey !== dayKey) {
      day = { dayKey, groups: [] };
      days.push(day);
    }
    const last = day.groups[day.groups.length - 1];
    if (last && last.albumId === event.albumId) {
      last.events.push(event);
    } else {
      day.groups.push({
        dayKey,
        albumId: event.albumId,
        artistId: event.artistId,
        events: [event],
      });
    }
  }
  return days;
}

// ---------------------------------------------------------------------------
// Stats — additions
// ---------------------------------------------------------------------------

/** Wall-clock depth of the library: distinct listened tracks, not replays. */
export function totalListenedDurationMs(tracks: Track[]): number {
  let ms = 0;
  for (const t of tracks) {
    // Same predicate as countListenedTracks so the two tiles never disagree.
    if (t.status === 'listened') ms += t.durationMs || 0;
  }
  return ms;
}

/**
 * Time actually spent listening in a window: one event, one play. Replays
 * count again, which is what makes this respond to the period filter.
 */
export function listenedDurationFromEvents(
  events: ListenEvent[],
  tracksById: Record<string, Track>,
): number {
  let ms = 0;
  for (const e of events) {
    ms += tracksById[e.trackId]?.durationMs || 0;
  }
  return ms;
}

export interface DayCount {
  day: string; // 'YYYY-MM-DD'
  count: number;
}

/** Contiguous daily counts ending today, oldest-first — heatmap input. */
export function listenEventsByDay(
  events: ListenEvent[],
  days = 365,
  now: Date = new Date(),
): DayCount[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const key = localDayKey(e.listenedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: DayCount[] = [];
  for (let i = days - 1; i >= 0; i--) {
    // Date arithmetic via the constructor, so month rollover and DST are free.
    const key = dayKeyOf(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - i),
    );
    out.push({ day: key, count: counts.get(key) ?? 0 });
  }
  return out;
}

export interface YearBucket {
  bucket: string; // '1995–1999'
  count: number;
}

/**
 * Which eras the user actually dug into: albums holding at least one listened
 * track, bucketed into contiguous 5-year ranges. Counts albums, not tracks.
 */
export function releaseYearDistribution(
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
): YearBucket[] {
  const years: number[] = [];
  for (const album of albums) {
    const tracks = tracksByAlbum[album.id] ?? [];
    if (!tracks.some((t) => t.status === 'listened')) continue;
    const year = Number(releaseDateKey(album.releaseDate).slice(0, 4));
    // Drops the '0000' bucket a malformed releaseDate would otherwise create,
    // which would stretch the axis back two millennia.
    if (!Number.isFinite(year) || year <= 0) continue;
    years.push(year);
  }
  if (years.length === 0) return [];
  const floor5 = (y: number) => Math.floor(y / 5) * 5;
  const min = floor5(Math.min(...years));
  const max = floor5(Math.max(...years));
  const out: YearBucket[] = [];
  for (let start = min; start <= max; start += 5) {
    out.push({ bucket: `${start}–${start + 4}`, count: 0 });
  }
  // Empty buckets are kept so the chart reads as a timeline, not a ranking.
  for (const y of years) out[(floor5(y) - min) / 5].count += 1;
  return out;
}

export interface ArtistProgressRank {
  artist: Artist;
  processed: number;
  total: number;
  ratio: number;
  /** The nudge number: tracks left before 완주. */
  remaining: number;
}

/** In-flight artists closest to 완주, fewest remaining tracks first. */
export function artistProgressRanking(
  artists: Artist[],
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
  limit = 5,
): ArtistProgressRank[] {
  return artists
    .map((artist) => {
      const p = getArtistProgress(artist, albums, tracksByAlbum);
      return { artist, ...p, remaining: p.total - p.processed };
    })
    // remaining > 0 drops 완주 artists, processed > 0 drops not-started ones —
    // both already have their own home on the Home screen.
    .filter((r) => r.total > 0 && r.remaining > 0 && r.processed > 0)
    .sort(
      (a, b) =>
        a.remaining - b.remaining ||
        b.ratio - a.ratio ||
        a.artist.name.localeCompare(b.artist.name, 'ko'),
    )
    .slice(0, limit);
}

export interface AlbumTypeCount {
  label: string;
  count: number;
}

/** How many albums of each type the user has finished. */
export function completedAlbumTypeDistribution(
  albums: Album[],
  tracksByAlbum: TracksByAlbum,
): AlbumTypeCount[] {
  const order = ['정규', 'EP', '싱글', '컴필레이션'];
  const counts = new Map<string, number>(order.map((l) => [l, 0]));
  for (const album of albums) {
    const tracks = tracksByAlbum[album.id] ?? [];
    if (tracks.length === 0) continue;
    if (!getAlbumProgress(album, tracks).complete) continue;
    const label = getAlbumTypeLabel(album);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return order.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

export interface RatingHabits {
  averageRating: number | null;
  /** Rated tracks over listened tracks, 0..1. */
  ratedShare: number;
  likedShare: number;
  skippedShare: number;
}

export function ratingHabits(tracks: Track[]): RatingHabits {
  let ratedSum = 0;
  let rated = 0;
  let listened = 0;
  let liked = 0;
  let skipped = 0;
  for (const t of tracks) {
    if (t.rating != null) {
      ratedSum += t.rating;
      rated += 1;
    }
    if (t.status === 'listened') listened += 1;
    if (t.status === 'skipped') skipped += 1;
    if (t.likedAt) liked += 1;
  }
  const processed = listened + skipped;
  return {
    averageRating: rated > 0 ? ratedSum / rated : null,
    ratedShare: listened > 0 ? rated / listened : 0,
    likedShare: listened > 0 ? liked / listened : 0,
    skippedShare: processed > 0 ? skipped / processed : 0,
  };
}

/**
 * "You loved this artist — you haven't touched these." The only recommendation
 * shape still possible: Spotify killed /recommendations and /related-artists,
 * so this is derived entirely from local ratings.
 */
export function suggestedUnheardAlbums(
  artists: Artist[],
  albums: Album[],
  tracks: Track[],
  tracksByAlbum: TracksByAlbum,
  limit = 6,
): Album[] {
  const loved = topRatedArtists(artists, albums, tracks, artists.length).filter(
    (r) => r.rating >= 4,
  );
  const out: Album[] = [];
  for (const { item: artist } of loved) {
    const picks = getInScopeAlbums(artist, albums)
      .filter((al) => {
        const p = getAlbumProgress(al, tracksByAlbum[al.id] ?? []);
        // total > 0 guards the totalTracks:0 case, which getAlbumProgress
        // reports as complete-but-unprocessed and would render as a dead tile.
        return p.processed === 0 && p.total > 0;
      })
      // Cap per artist so one favourite cannot fill the whole shelf.
      .slice(0, 2);
    out.push(...picks);
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}

/** Events from roughly one year ago (±windowDays), newest-first. */
export function onThisDay(
  events: ListenEvent[],
  now: Date = new Date(),
  windowDays = 3,
): ListenEvent[] {
  const anchor = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  // Membership over precomputed day keys rather than timestamp ranges, so DST
  // and half-open-interval bugs never enter the picture.
  const keys = new Set<string>();
  for (let d = -windowDays; d <= windowDays; d++) {
    keys.add(
      dayKeyOf(
        new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + d),
      ),
    );
  }
  return events
    .filter((e) => keys.has(localDayKey(e.listenedAt)))
    .sort((a, b) => b.listenedAt.localeCompare(a.listenedAt));
}
