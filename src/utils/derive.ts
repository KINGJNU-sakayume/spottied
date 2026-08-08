import type {
  Album,
  Artist,
  ArtistDigStatus,
  ListenEvent,
  Track,
} from '../types';

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

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
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
    for (const g of a.genres) {
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
  const days = [...new Set(events.map((e) => localDateKey(e.listenedAt)))].sort();
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

  const todayKey = localDateKey(now.toISOString());
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
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
