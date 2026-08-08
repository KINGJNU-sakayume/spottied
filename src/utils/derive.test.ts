import { describe, expect, it } from 'vitest';
import type { Album, Artist, ListenEvent, Track } from '../types';
import {
  countCompletedArtists,
  formatResumeText,
  genreDistribution,
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
