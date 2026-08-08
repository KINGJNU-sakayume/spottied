import { describe, expect, it } from 'vitest';
import type { Album, Artist, ListenEvent, Track } from '../types';
import {
  artistProgressRanking,
  completedAlbumTypeDistribution,
  countCompletedArtists,
  formatResumeText,
  genreDistribution,
  groupAlbumsByYear,
  groupLogEvents,
  listenEventsByDay,
  listenedDurationFromEvents,
  onThisDay,
  ratingHabits,
  releaseYearDistribution,
  suggestedUnheardAlbums,
  totalListenedDurationMs,
  getAlbumProgress,
  getAlbumTypeLabel,
  getArtistProgress,
  getArtistStatus,
  getInScopeAlbums,
  getResumePoint,
  listenEventsByMonth,
  listenStreak,
  ratingDistribution,
  releaseDateKey,
  sortAlbumsByRelease,
  sortTracks,
  topRelistenedTracks,
} from './derive';

function mkArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: 'artist1',
    name: '아티스트',
    images: [],
    genres: [],
    addedAt: '2026-01-01T00:00:00.000Z',
    scope: { album: true, single: true, compilation: false },
    discographySyncedAt: null,
    ...overrides,
  };
}

function mkAlbum(overrides: Partial<Album> = {}): Album {
  return {
    id: 'album1',
    artistId: 'artist1',
    name: '앨범',
    albumGroup: 'album',
    releaseDate: '2020-01-01',
    totalTracks: 2,
    images: [],
    excluded: false,
    tracksSyncedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function mkTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track1',
    albumId: 'album1',
    artistId: 'artist1',
    name: '트랙',
    discNumber: 1,
    trackNumber: 1,
    durationMs: 200000,
    status: 'none',
    ...overrides,
  };
}

function mkEvent(overrides: Partial<ListenEvent> = {}): ListenEvent {
  return {
    id: crypto.randomUUID(),
    trackId: 'track1',
    albumId: 'album1',
    artistId: 'artist1',
    listenedAt: '2026-03-01T12:00:00.000Z',
    source: 'manual',
    ...overrides,
  };
}

describe('releaseDateKey', () => {
  it('pads year-only and year-month dates without crashing', () => {
    expect(releaseDateKey('1999')).toBe('1999-01-01');
    expect(releaseDateKey('1999-05')).toBe('1999-05-01');
    expect(releaseDateKey('1999-05-21')).toBe('1999-05-21');
  });

  it('sorts year-only dates against full dates', () => {
    const albums = [
      mkAlbum({ id: 'b', releaseDate: '2001-06-15' }),
      mkAlbum({ id: 'a', releaseDate: '1999' }),
      mkAlbum({ id: 'c', releaseDate: '2001' }),
    ];
    expect(sortAlbumsByRelease(albums).map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('getAlbumTypeLabel', () => {
  it('classifies singles with >= 4 tracks as EP', () => {
    expect(
      getAlbumTypeLabel(mkAlbum({ albumGroup: 'single', totalTracks: 4 })),
    ).toBe('EP');
    expect(
      getAlbumTypeLabel(mkAlbum({ albumGroup: 'single', totalTracks: 3 })),
    ).toBe('싱글');
    expect(getAlbumTypeLabel(mkAlbum({ albumGroup: 'album' }))).toBe('정규');
    expect(getAlbumTypeLabel(mkAlbum({ albumGroup: 'compilation' }))).toBe(
      '컴필레이션',
    );
  });
});

describe('getAlbumProgress', () => {
  it('counts listened and skipped tracks as processed', () => {
    const album = mkAlbum({ totalTracks: 3 });
    const tracks = [
      mkTrack({ id: 't1', status: 'listened' }),
      mkTrack({ id: 't2', trackNumber: 2, status: 'skipped' }),
      mkTrack({ id: 't3', trackNumber: 3, status: 'none' }),
    ];
    const p = getAlbumProgress(album, tracks);
    expect(p.processed).toBe(2);
    expect(p.total).toBe(3);
    expect(p.complete).toBe(false);
  });

  it('is complete only when every track is processed', () => {
    const album = mkAlbum({ totalTracks: 2 });
    const tracks = [
      mkTrack({ id: 't1', status: 'listened' }),
      mkTrack({ id: 't2', trackNumber: 2, status: 'skipped' }),
    ];
    expect(getAlbumProgress(album, tracks).complete).toBe(true);
  });

  it('uses totalTracks when tracks are not cached yet', () => {
    const album = mkAlbum({ totalTracks: 12, tracksSyncedAt: null });
    const p = getAlbumProgress(album, []);
    expect(p.total).toBe(12);
    expect(p.processed).toBe(0);
    expect(p.complete).toBe(false);
  });
});

describe('getInScopeAlbums', () => {
  it('filters by scope toggles and exclusion, sorted by release', () => {
    const artist = mkArtist({
      scope: { album: true, single: false, compilation: false },
    });
    const albums = [
      mkAlbum({ id: 'a2', releaseDate: '2022' }),
      mkAlbum({ id: 'a1', releaseDate: '2020' }),
      mkAlbum({ id: 's1', albumGroup: 'single', releaseDate: '2019' }),
      mkAlbum({ id: 'x1', releaseDate: '2018', excluded: true }),
      mkAlbum({ id: 'other', artistId: 'artist2', releaseDate: '2017' }),
    ];
    expect(getInScopeAlbums(artist, albums).map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});

describe('getArtistStatus', () => {
  const artist = mkArtist({ scope: { album: true, single: true, compilation: false } });

  it('is not-started with no processed track anywhere', () => {
    const albums = [mkAlbum()];
    const tracks = { album1: [mkTrack()] };
    expect(getArtistStatus(artist, albums, tracks)).toBe('not-started');
  });

  it('is in-progress with some processed tracks', () => {
    const albums = [mkAlbum()];
    const tracks = {
      album1: [mkTrack({ status: 'listened' }), mkTrack({ id: 't2', trackNumber: 2 })],
    };
    expect(getArtistStatus(artist, albums, tracks)).toBe('in-progress');
  });

  it('is completed when every in-scope album is complete', () => {
    const albums = [
      mkAlbum({ id: 'a1' }),
      mkAlbum({ id: 'a2', releaseDate: '2021' }),
    ];
    const tracks = {
      a1: [mkTrack({ id: 't1', albumId: 'a1', status: 'listened' })],
      a2: [mkTrack({ id: 't2', albumId: 'a2', status: 'skipped' })],
    };
    expect(getArtistStatus(artist, albums, tracks)).toBe('completed');
  });

  it('recomputes when an incomplete album is excluded', () => {
    const albums = [
      mkAlbum({ id: 'a1' }),
      mkAlbum({ id: 'a2', releaseDate: '2021' }),
    ];
    const tracks = {
      a1: [mkTrack({ id: 't1', albumId: 'a1', status: 'listened' })],
      a2: [mkTrack({ id: 't2', albumId: 'a2', status: 'none' })],
    };
    expect(getArtistStatus(artist, albums, tracks)).toBe('in-progress');
    const withExclusion = [albums[0], { ...albums[1], excluded: true }];
    expect(getArtistStatus(artist, withExclusion, tracks)).toBe('completed');
  });

  it('recomputes when scope toggles change', () => {
    const albums = [
      mkAlbum({ id: 'a1' }),
      mkAlbum({ id: 's1', albumGroup: 'single', releaseDate: '2021' }),
    ];
    const tracks = {
      a1: [mkTrack({ id: 't1', albumId: 'a1', status: 'listened' })],
      s1: [mkTrack({ id: 't2', albumId: 's1', status: 'none' })],
    };
    expect(getArtistStatus(artist, albums, tracks)).toBe('in-progress');
    const albumOnly = mkArtist({
      scope: { album: true, single: false, compilation: false },
    });
    expect(getArtistStatus(albumOnly, albums, tracks)).toBe('completed');
  });
});

describe('getResumePoint', () => {
  const artist = mkArtist();

  it('walks albums in release order and tracks in disc/track order', () => {
    const albums = [
      mkAlbum({ id: 'a2', releaseDate: '2021' }),
      mkAlbum({ id: 'a1', releaseDate: '2019' }),
    ];
    const tracks = {
      a1: [
        mkTrack({ id: 't1', albumId: 'a1', trackNumber: 1, status: 'listened' }),
        mkTrack({ id: 't3', albumId: 'a1', discNumber: 2, trackNumber: 1 }),
        mkTrack({ id: 't2', albumId: 'a1', trackNumber: 2, status: 'skipped' }),
      ],
      a2: [mkTrack({ id: 't4', albumId: 'a2' })],
    };
    const rp = getResumePoint(artist, albums, tracks);
    expect(rp?.album.id).toBe('a1');
    expect(rp?.track?.id).toBe('t3');
    expect(rp?.albumIndex).toBe(0);
  });

  it('returns null when everything is processed', () => {
    const albums = [mkAlbum({ id: 'a1', totalTracks: 1 })];
    const tracks = { a1: [mkTrack({ id: 't1', albumId: 'a1', status: 'listened' })] };
    expect(getResumePoint(artist, albums, tracks)).toBeNull();
  });

  it('returns the album with a null track when tracks are not cached', () => {
    const albums = [mkAlbum({ id: 'a1', tracksSyncedAt: null, totalTracks: 10 })];
    const rp = getResumePoint(artist, albums, {});
    expect(rp?.album.id).toBe('a1');
    expect(rp?.track).toBeNull();
  });

  it('formats the resume text', () => {
    const albums = [
      mkAlbum({ id: 'a1', releaseDate: '2019' }),
      mkAlbum({ id: 'a2', releaseDate: '2020' }),
      mkAlbum({ id: 'a3', releaseDate: '2021' }),
    ];
    const tracks = {
      a1: [mkTrack({ id: 't1', albumId: 'a1', status: 'listened' })],
      a2: [mkTrack({ id: 't2', albumId: 'a2', status: 'skipped' })],
      a3: [
        mkTrack({ id: 't3', albumId: 'a3', trackNumber: 4, status: 'listened' }),
        mkTrack({ id: 't4', albumId: 'a3', trackNumber: 5, name: '트랙명' }),
      ],
    };
    const rp = getResumePoint(artist, albums, tracks);
    expect(rp).not.toBeNull();
    expect(formatResumeText(rp!)).toBe('3번째 앨범 · 5. 트랙명');
  });
});

describe('getArtistProgress / countCompletedArtists', () => {
  it('sums processed and total across in-scope albums', () => {
    const artist = mkArtist();
    const albums = [
      mkAlbum({ id: 'a1', totalTracks: 2 }),
      mkAlbum({ id: 'a2', releaseDate: '2021', totalTracks: 3, tracksSyncedAt: null }),
    ];
    const tracks = {
      a1: [
        mkTrack({ id: 't1', albumId: 'a1', status: 'listened' }),
        mkTrack({ id: 't2', albumId: 'a1', trackNumber: 2 }),
      ],
    };
    const p = getArtistProgress(artist, albums, tracks);
    expect(p.processed).toBe(1);
    expect(p.total).toBe(5);
  });

  it('counts completed artists', () => {
    const done = mkArtist({ id: 'done' });
    const wip = mkArtist({ id: 'wip' });
    const albums = [
      mkAlbum({ id: 'a1', artistId: 'done', totalTracks: 1 }),
      mkAlbum({ id: 'a2', artistId: 'wip', totalTracks: 1 }),
    ];
    const tracks = {
      a1: [mkTrack({ id: 't1', albumId: 'a1', artistId: 'done', status: 'listened' })],
      a2: [mkTrack({ id: 't2', albumId: 'a2', artistId: 'wip' })],
    };
    expect(countCompletedArtists([done, wip], albums, tracks)).toBe(1);
  });
});

describe('sortTracks', () => {
  it('orders by disc then track number', () => {
    const tracks = [
      mkTrack({ id: 'c', discNumber: 2, trackNumber: 1 }),
      mkTrack({ id: 'b', discNumber: 1, trackNumber: 2 }),
      mkTrack({ id: 'a', discNumber: 1, trackNumber: 1 }),
    ];
    expect(sortTracks(tracks).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('stats', () => {
  it('groups listen events by month with fixed now', () => {
    const events = [
      mkEvent({ listenedAt: '2026-03-05T10:00:00.000Z' }),
      mkEvent({ listenedAt: '2026-03-20T10:00:00.000Z' }),
      mkEvent({ listenedAt: '2026-01-02T10:00:00.000Z' }),
    ];
    const out = listenEventsByMonth(events, 3, new Date('2026-03-15T12:00:00'));
    expect(out).toEqual([
      { month: '2026.01', count: 1 },
      { month: '2026.02', count: 0 },
      { month: '2026.03', count: 2 },
    ]);
  });

  it('builds a half-step rating distribution', () => {
    const dist = ratingDistribution([
      { rating: 0.5 },
      { rating: 5 },
      { rating: 5 },
      { rating: 3.5 },
      {},
    ]);
    expect(dist).toHaveLength(10);
    expect(dist[0]).toEqual({ rating: 0.5, count: 1 });
    expect(dist[6]).toEqual({ rating: 3.5, count: 1 });
    expect(dist[9]).toEqual({ rating: 5, count: 2 });
  });

  it('computes listen streaks', () => {
    const events = [
      mkEvent({ listenedAt: '2026-03-13T10:00:00' }),
      mkEvent({ listenedAt: '2026-03-14T10:00:00' }),
      mkEvent({ listenedAt: '2026-03-15T10:00:00' }),
      mkEvent({ listenedAt: '2026-03-01T10:00:00' }),
      mkEvent({ listenedAt: '2026-03-02T10:00:00' }),
    ];
    const s = listenStreak(events, new Date('2026-03-15T20:00:00'));
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);

    const stale = listenStreak(events, new Date('2026-03-20T20:00:00'));
    expect(stale.current).toBe(0);
    expect(stale.longest).toBe(3);
  });

  it('ranks re-listened tracks (2+ events only)', () => {
    const t1 = mkTrack({ id: 't1' });
    const t2 = mkTrack({ id: 't2' });
    const events = [
      mkEvent({ trackId: 't1' }),
      mkEvent({ trackId: 't1' }),
      mkEvent({ trackId: 't1' }),
      mkEvent({ trackId: 't2' }),
    ];
    const top = topRelistenedTracks(events, { t1, t2 });
    expect(top).toHaveLength(1);
    expect(top[0].track.id).toBe('t1');
    expect(top[0].count).toBe(3);
  });

  it('computes genre distribution', () => {
    const artists = [
      mkArtist({ id: 'a', genres: ['k-pop', 'pop'] }),
      mkArtist({ id: 'b', genres: ['pop'] }),
    ];
    expect(genreDistribution(artists)).toEqual([
      { genre: 'pop', count: 2 },
      { genre: 'k-pop', count: 1 },
    ]);
  });
});

describe('groupAlbumsByYear', () => {
  it('groups ascending by year, keeping release order inside a year', () => {
    const groups = groupAlbumsByYear([
      mkAlbum({ id: 'b', releaseDate: '2007-05-01', name: 'B' }),
      mkAlbum({ id: 'a', releaseDate: '1999-06-01', name: 'A' }),
      mkAlbum({ id: 'c', releaseDate: '1999-02-01', name: 'C' }),
    ]);
    expect(groups.map((g) => g.year)).toEqual(['1999', '2007']);
    expect(groups[0].albums.map((a) => a.id)).toEqual(['c', 'a']);
  });

  it('buckets year-only release dates with full dates of the same year', () => {
    const groups = groupAlbumsByYear([
      mkAlbum({ id: 'a', releaseDate: '1999' }),
      mkAlbum({ id: 'b', releaseDate: '1999-06-01' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].year).toBe('1999');
    expect(groups[0].albums).toHaveLength(2);
  });

  it('returns an empty array for no albums', () => {
    expect(groupAlbumsByYear([])).toEqual([]);
  });

  it('does not throw on a blank release date', () => {
    const groups = groupAlbumsByYear([mkAlbum({ releaseDate: '' })]);
    expect(groups[0].year).toBe('0000');
  });
});

describe('groupLogEvents', () => {
  it('collapses consecutive same-album events, newest day first', () => {
    const days = groupLogEvents([
      mkEvent({ id: '1', albumId: 'al1', listenedAt: '2026-03-01T10:00:00' }),
      mkEvent({ id: '2', albumId: 'al1', listenedAt: '2026-03-01T11:00:00' }),
      mkEvent({ id: '3', albumId: 'al2', listenedAt: '2026-03-02T09:00:00' }),
    ]);
    expect(days.map((d) => d.dayKey)).toEqual(['2026-03-02', '2026-03-01']);
    expect(days[1].groups).toHaveLength(1);
    expect(days[1].groups[0].events.map((e) => e.id)).toEqual(['2', '1']);
  });

  it('does not merge the same album across an intervening album', () => {
    const days = groupLogEvents([
      mkEvent({ id: '1', albumId: 'al1', listenedAt: '2026-03-01T10:00:00' }),
      mkEvent({ id: '2', albumId: 'al2', listenedAt: '2026-03-01T11:00:00' }),
      mkEvent({ id: '3', albumId: 'al1', listenedAt: '2026-03-01T12:00:00' }),
    ]);
    expect(days[0].groups).toHaveLength(3);
  });

  it('splits the same album across a local midnight', () => {
    const days = groupLogEvents([
      mkEvent({ id: '1', albumId: 'al1', listenedAt: '2026-03-01T23:50:00' }),
      mkEvent({ id: '2', albumId: 'al1', listenedAt: '2026-03-02T00:10:00' }),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0].groups[0].events.map((e) => e.id)).toEqual(['2']);
  });

  it('orders a bulk mark deterministically despite one shared timestamp', () => {
    const at = '2026-03-01T12:00:00';
    const days = groupLogEvents([
      mkEvent({ id: 'c', albumId: 'al1', listenedAt: at }),
      mkEvent({ id: 'a', albumId: 'al1', listenedAt: at }),
      mkEvent({ id: 'b', albumId: 'al1', listenedAt: at }),
    ]);
    expect(days[0].groups).toHaveLength(1);
    expect(days[0].groups[0].events.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty array for no events', () => {
    expect(groupLogEvents([])).toEqual([]);
  });
});

describe('listen duration', () => {
  it('sums only listened tracks', () => {
    const tracks = [
      mkTrack({ id: 'a', status: 'listened', durationMs: 1000 }),
      mkTrack({ id: 'b', status: 'skipped', durationMs: 500 }),
      mkTrack({ id: 'c', status: 'none', durationMs: 700 }),
    ];
    expect(totalListenedDurationMs(tracks)).toBe(1000);
  });

  it('does not produce NaN when a duration is missing', () => {
    const broken = mkTrack({ status: 'listened' });
    delete (broken as { durationMs?: number }).durationMs;
    expect(totalListenedDurationMs([broken])).toBe(0);
  });

  it('counts replays separately when summing from events', () => {
    const t = mkTrack({ id: 't1', durationMs: 1000 });
    const events = [mkEvent({ trackId: 't1' }), mkEvent({ trackId: 't1' })];
    expect(listenedDurationFromEvents(events, { t1: t })).toBe(2000);
  });

  it('skips events whose track is unknown', () => {
    expect(listenedDurationFromEvents([mkEvent({ trackId: 'gone' })], {})).toBe(0);
  });
});

describe('listenEventsByDay', () => {
  it('emits a dense oldest-first range ending today', () => {
    const days = listenEventsByDay(
      [
        mkEvent({ listenedAt: '2026-03-15T10:00:00' }),
        mkEvent({ listenedAt: '2026-03-15T20:00:00' }),
        mkEvent({ listenedAt: '2026-03-13T10:00:00' }),
      ],
      3,
      new Date(2026, 2, 15),
    );
    expect(days).toEqual([
      { day: '2026-03-13', count: 1 },
      { day: '2026-03-14', count: 0 },
      { day: '2026-03-15', count: 2 },
    ]);
  });

  it('excludes events older than the window', () => {
    const days = listenEventsByDay(
      [mkEvent({ listenedAt: '2025-01-01T10:00:00' })],
      7,
      new Date(2026, 2, 15),
    );
    expect(days.every((d) => d.count === 0)).toBe(true);
  });

  it('crosses a month boundary correctly', () => {
    const days = listenEventsByDay([], 4, new Date(2026, 2, 2));
    expect(days[0].day).toBe('2026-02-27');
  });

  it('returns an empty array for a zero-day window', () => {
    expect(listenEventsByDay([], 0, new Date(2026, 2, 15))).toEqual([]);
  });
});

describe('releaseYearDistribution', () => {
  it('buckets listened albums into contiguous 5-year ranges', () => {
    const albums = [
      mkAlbum({ id: 'a', releaseDate: '1993-01-01' }),
      mkAlbum({ id: 'b', releaseDate: '1997-01-01' }),
      mkAlbum({ id: 'c', releaseDate: '2007-01-01' }),
    ];
    const listened = (albumId: string) => [
      mkTrack({ id: `${albumId}t`, albumId, status: 'listened' }),
    ];
    expect(
      releaseYearDistribution(albums, {
        a: listened('a'),
        b: listened('b'),
        c: listened('c'),
      }),
    ).toEqual([
      { bucket: '1990–1994', count: 1 },
      { bucket: '1995–1999', count: 1 },
      { bucket: '2000–2004', count: 0 },
      { bucket: '2005–2009', count: 1 },
    ]);
  });

  it('ignores albums with no listened tracks and uncached albums', () => {
    const albums = [mkAlbum({ id: 'a' }), mkAlbum({ id: 'b' })];
    expect(
      releaseYearDistribution(albums, {
        a: [mkTrack({ albumId: 'a', status: 'skipped' })],
      }),
    ).toEqual([]);
  });

  it('drops a malformed release date instead of stretching the axis', () => {
    const albums = [
      mkAlbum({ id: 'a', releaseDate: '' }),
      mkAlbum({ id: 'b', releaseDate: '1999' }),
    ];
    const listened = (albumId: string) => [
      mkTrack({ id: `${albumId}t`, albumId, status: 'listened' }),
    ];
    expect(
      releaseYearDistribution(albums, { a: listened('a'), b: listened('b') }),
    ).toEqual([{ bucket: '1995–1999', count: 1 }]);
  });
});

describe('artistProgressRanking', () => {
  it('ranks by fewest remaining tracks, not by highest ratio', () => {
    const near = mkArtist({ id: 'near', name: '가' });
    const ahead = mkArtist({ id: 'ahead', name: '나' });
    const albums = [
      mkAlbum({ id: 'n1', artistId: 'near', totalTracks: 10 }),
      mkAlbum({ id: 'a1', artistId: 'ahead', totalTracks: 4 }),
    ];
    const tracksByAlbum = {
      // 8/10 listened — lower ratio, but only 2 left.
      n1: Array.from({ length: 10 }, (_, i) =>
        mkTrack({
          id: `n${i}`,
          albumId: 'n1',
          artistId: 'near',
          trackNumber: i + 1,
          status: i < 8 ? 'listened' : 'none',
        }),
      ),
      // 1/4 listened — 3 left.
      a1: Array.from({ length: 4 }, (_, i) =>
        mkTrack({
          id: `a${i}`,
          albumId: 'a1',
          artistId: 'ahead',
          trackNumber: i + 1,
          status: i < 1 ? 'listened' : 'none',
        }),
      ),
    };
    const ranked = artistProgressRanking([ahead, near], albums, tracksByAlbum);
    expect(ranked.map((r) => r.artist.id)).toEqual(['near', 'ahead']);
    expect(ranked[0].remaining).toBe(2);
  });

  it('excludes completed and not-started artists', () => {
    const done = mkArtist({ id: 'done' });
    const fresh = mkArtist({ id: 'fresh' });
    const albums = [
      mkAlbum({ id: 'd1', artistId: 'done', totalTracks: 1 }),
      mkAlbum({ id: 'f1', artistId: 'fresh', totalTracks: 1 }),
    ];
    const tracksByAlbum = {
      d1: [mkTrack({ id: 'd', albumId: 'd1', artistId: 'done', status: 'listened' })],
      f1: [mkTrack({ id: 'f', albumId: 'f1', artistId: 'fresh', status: 'none' })],
    };
    expect(artistProgressRanking([done, fresh], albums, tracksByAlbum)).toEqual([]);
  });

  it('excludes an artist whose only album is excluded', () => {
    const artist = mkArtist({ id: 'a' });
    const albums = [mkAlbum({ id: 'x', artistId: 'a', excluded: true })];
    expect(artistProgressRanking([artist], albums, {})).toEqual([]);
  });
});

describe('completedAlbumTypeDistribution', () => {
  it('counts finished albums per display type', () => {
    const albums = [
      mkAlbum({ id: 'lp', albumGroup: 'album', totalTracks: 1 }),
      mkAlbum({ id: 'ep', albumGroup: 'single', totalTracks: 4 }),
      mkAlbum({ id: 'unfinished', albumGroup: 'album', totalTracks: 2 }),
    ];
    const tracksByAlbum = {
      lp: [mkTrack({ id: '1', albumId: 'lp', status: 'listened' })],
      ep: Array.from({ length: 4 }, (_, i) =>
        mkTrack({ id: `e${i}`, albumId: 'ep', trackNumber: i + 1, status: 'listened' }),
      ),
      unfinished: [
        mkTrack({ id: 'u1', albumId: 'unfinished', status: 'listened' }),
        mkTrack({ id: 'u2', albumId: 'unfinished', trackNumber: 2, status: 'none' }),
      ],
    };
    expect(completedAlbumTypeDistribution(albums, tracksByAlbum)).toEqual([
      { label: '정규', count: 1 },
      { label: 'EP', count: 1 },
      { label: '싱글', count: 0 },
      { label: '컴필레이션', count: 0 },
    ]);
  });
});

describe('ratingHabits', () => {
  it('computes averages and shares over listened tracks', () => {
    const tracks = [
      mkTrack({ id: '1', status: 'listened', rating: 4, likedAt: 'x' }),
      mkTrack({ id: '2', status: 'listened', rating: 5 }),
      mkTrack({ id: '3', status: 'listened' }),
      mkTrack({ id: '4', status: 'skipped' }),
    ];
    const habits = ratingHabits(tracks);
    expect(habits.averageRating).toBe(4.5);
    expect(habits.ratedShare).toBeCloseTo(2 / 3);
    expect(habits.likedShare).toBeCloseTo(1 / 3);
    expect(habits.skippedShare).toBeCloseTo(1 / 4);
  });

  it('reports a null average when nothing is rated', () => {
    expect(ratingHabits([mkTrack({ status: 'listened' })]).averageRating).toBeNull();
  });
});

describe('suggestedUnheardAlbums', () => {
  const artist = mkArtist({ id: 'a1' });

  it('suggests untouched albums from highly rated artists, capped at two', () => {
    const albums = [
      mkAlbum({ id: 'rated', artistId: 'a1', rating: 4.5, releaseDate: '2000-01-01' }),
      mkAlbum({ id: 'u1', artistId: 'a1', releaseDate: '2001-01-01' }),
      mkAlbum({ id: 'u2', artistId: 'a1', releaseDate: '2002-01-01' }),
      mkAlbum({ id: 'u3', artistId: 'a1', releaseDate: '2003-01-01' }),
    ];
    const suggested = suggestedUnheardAlbums([artist], albums, [], {
      rated: [mkTrack({ id: 'r', albumId: 'rated', status: 'listened' })],
    });
    expect(suggested.map((a) => a.id)).toEqual(['u1', 'u2']);
  });

  it('ignores artists rated below 4.0', () => {
    const albums = [
      mkAlbum({ id: 'rated', artistId: 'a1', rating: 3.9 }),
      mkAlbum({ id: 'u1', artistId: 'a1', releaseDate: '2001-01-01' }),
    ];
    expect(suggestedUnheardAlbums([artist], albums, [], {})).toEqual([]);
  });

  it('skips albums that are already started, excluded or out of scope', () => {
    const albums = [
      mkAlbum({ id: 'rated', artistId: 'a1', rating: 5 }),
      mkAlbum({ id: 'started', artistId: 'a1', releaseDate: '2001-01-01' }),
      mkAlbum({ id: 'hidden', artistId: 'a1', releaseDate: '2002-01-01', excluded: true }),
      mkAlbum({
        id: 'comp',
        artistId: 'a1',
        releaseDate: '2003-01-01',
        albumGroup: 'compilation',
      }),
    ];
    const suggested = suggestedUnheardAlbums([artist], albums, [], {
      rated: [mkTrack({ id: 'r', albumId: 'rated', status: 'listened' })],
      started: [mkTrack({ id: 's', albumId: 'started', status: 'skipped' })],
    });
    expect(suggested).toEqual([]);
  });

  it('does not suggest an album with no tracks at all', () => {
    const albums = [
      mkAlbum({ id: 'rated', artistId: 'a1', rating: 5 }),
      mkAlbum({ id: 'empty', artistId: 'a1', releaseDate: '2001-01-01', totalTracks: 0 }),
    ];
    expect(
      suggestedUnheardAlbums([artist], albums, [], {
        rated: [mkTrack({ id: 'r', albumId: 'rated', status: 'listened' })],
      }),
    ).toEqual([]);
  });

  it('honours the limit', () => {
    const albums = [
      mkAlbum({ id: 'rated', artistId: 'a1', rating: 5 }),
      mkAlbum({ id: 'u1', artistId: 'a1', releaseDate: '2001-01-01' }),
      mkAlbum({ id: 'u2', artistId: 'a1', releaseDate: '2002-01-01' }),
    ];
    const suggested = suggestedUnheardAlbums(
      [artist],
      albums,
      [],
      { rated: [mkTrack({ id: 'r', albumId: 'rated', status: 'listened' })] },
      1,
    );
    expect(suggested.map((a) => a.id)).toEqual(['u1']);
  });
});

describe('onThisDay', () => {
  const now = new Date(2026, 2, 15);

  it('includes events from a year ago within the window, newest first', () => {
    const events = [
      mkEvent({ id: 'edge', listenedAt: '2025-03-18T10:00:00' }),
      mkEvent({ id: 'exact', listenedAt: '2025-03-15T10:00:00' }),
      mkEvent({ id: 'outside', listenedAt: '2025-03-19T10:00:00' }),
    ];
    expect(onThisDay(events, now).map((e) => e.id)).toEqual(['edge', 'exact']);
  });

  it('narrows to the exact day with a zero window', () => {
    const events = [
      mkEvent({ id: 'exact', listenedAt: '2025-03-15T10:00:00' }),
      mkEvent({ id: 'near', listenedAt: '2025-03-16T10:00:00' }),
    ];
    expect(onThisDay(events, now, 0).map((e) => e.id)).toEqual(['exact']);
  });

  it('excludes today and two years ago', () => {
    const events = [
      mkEvent({ id: 'today', listenedAt: '2026-03-15T10:00:00' }),
      mkEvent({ id: 'old', listenedAt: '2024-03-15T10:00:00' }),
    ];
    expect(onThisDay(events, now)).toEqual([]);
  });
});
