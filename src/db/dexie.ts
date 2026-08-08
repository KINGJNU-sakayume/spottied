import Dexie, { type Table } from 'dexie';
import type { Album, Artist, ListenEvent, Track } from '../types';

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

  constructor() {
    super('spottied');
    this.version(1).stores({
      artists: 'id, name, addedAt',
      albums: 'id, artistId, releaseDate',
      tracks: 'id, albumId, artistId',
      listenEvents: 'id, trackId, albumId, artistId, listenedAt',
    });
  }
}

export const db = new SpottiedDB();
