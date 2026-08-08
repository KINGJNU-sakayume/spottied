import Dexie, { type Table } from 'dexie';
import type {
  Album,
  Artist,
  ListenEvent,
  RecentlyPlayedCache,
  Track,
} from '../types';

/**
 * Schema versioning: always add new versions with an explicit
 * `.version(n).stores(...)` call below the previous one so future tables
 * (e.g. v2 `achievements`, `earnedAchievements`) can be added
 * non-destructively. See docs/v2-achievements.md.
 */
class SpottiedDB extends Dexie {
  artists!: Table<Artist, string>;
  albums!: Table<Album, string>;
  tracks!: Table<Track, string>;
  listenEvents!: Table<ListenEvent, string>;
  recentlyPlayedCache!: Table<RecentlyPlayedCache, string>;

  constructor() {
    super('spottied');
    this.version(1).stores({
      artists: 'id, name, addedAt',
      albums: 'id, artistId, releaseDate',
      tracks: 'id, albumId, artistId',
      listenEvents: 'id, trackId, albumId, artistId, listenedAt',
    });
    // v2: offline cache of the last recently-played response. Purely
    // additive — Dexie carries the v1 tables forward, so only the new table
    // is listed and no .upgrade() callback is needed.
    this.version(2).stores({
      recentlyPlayedCache: 'id',
    });
  }
}

export const db = new SpottiedDB();
