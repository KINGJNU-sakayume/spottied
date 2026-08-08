import type {
  Album,
  AlbumGroup,
  RecentlyPlayedItem,
  SpotifyImage,
  Track,
} from '../../types';
import { SpotifyApiError, spotifyFetch } from './client';

interface Paging<T> {
  items: T[];
  next: string | null;
  total: number;
}

export interface SpotifyArtistObject {
  id: string;
  name: string;
  images: SpotifyImage[];
  // Deprecated in the February 2026 API change; may be absent.
  genres?: string[];
}

interface SpotifyAlbumObject {
  id: string;
  name: string;
  // album_group was removed in February 2026; album_type is the fallback.
  album_group?: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  images: SpotifyImage[];
}

interface SpotifyTrackObject {
  id: string;
  name: string;
  disc_number: number;
  track_number: number;
  duration_ms: number;
}

// Lives in types.ts so db/dexie.ts can cache it without the storage layer
// importing from the API layer. Re-exported here for existing callers.
export type { RecentlyPlayedItem } from '../../types';

/**
 * February 2026 lowered /v1/search's limit ceiling from 50 to 10 (default 20
 * to 5). Anything above 10 is rejected with a literal 400 "Invalid limit".
 */
export const SEARCH_PAGE_SIZE = 10;

/** Market for catalog lookups — never read from the user profile, whose
 * `country` field was removed in February 2026. */
export const CATALOG_MARKET = 'KR';

/**
 * Page size for the paginated discography endpoints. February 2026 lowered
 * the ceilings and the changelog is not reachable to confirm each one, so
 * this matches the documented search ceiling and `fetchPage` falls back to
 * Spotify's own default if even that is refused.
 */
export const CATALOG_PAGE_SIZE = 10;

/**
 * Runs a paginated request, retrying without `limit` if Spotify rejects the
 * page size. The paging loops below read `items.length` and `next`, so they
 * work with whatever page size comes back.
 */
async function fetchPage<T>(
  basePath: string,
  params: URLSearchParams,
): Promise<Paging<T>> {
  try {
    return await spotifyFetch<Paging<T>>(`${basePath}?${params.toString()}`);
  } catch (e) {
    const rejectedLimit =
      e instanceof SpotifyApiError &&
      e.status === 400 &&
      /invalid limit/i.test(e.message);
    if (!rejectedLimit || !params.has('limit')) throw e;
    const retry = new URLSearchParams(params);
    retry.delete('limit');
    return spotifyFetch<Paging<T>>(`${basePath}?${retry.toString()}`);
  }
}

export function buildArtistSearchPath(query: string, offset = 0): string {
  const params = new URLSearchParams({
    q: query,
    type: 'artist',
    market: CATALOG_MARKET,
    limit: String(SEARCH_PAGE_SIZE),
    offset: String(offset),
  });
  return `/v1/search?${params.toString()}`;
}

export interface ArtistSearchPage {
  items: SpotifyArtistObject[];
  hasMore: boolean;
  total: number;
}

export async function searchArtists(
  query: string,
  offset = 0,
): Promise<ArtistSearchPage> {
  const data = await spotifyFetch<{ artists: Paging<SpotifyArtistObject> }>(
    buildArtistSearchPath(query, offset),
  );
  return {
    items: data.artists.items,
    hasMore: data.artists.next != null,
    total: data.artists.total,
  };
}

export async function getArtist(id: string): Promise<SpotifyArtistObject> {
  return spotifyFetch<SpotifyArtistObject>(`/v1/artists/${id}`);
}

function normalizeGroup(group: string | undefined, type: string): AlbumGroup {
  const g = group ?? type;
  if (g === 'single') return 'single';
  if (g === 'compilation') return 'compilation';
  return 'album';
}

/** Full discography with pagination; `appears_on` is excluded entirely. */
export async function getArtistAlbums(artistId: string): Promise<Album[]> {
  const seen = new Set<string>();
  const albums: Album[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      include_groups: 'album,single,compilation',
      market: CATALOG_MARKET,
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(offset),
    });
    const page = await fetchPage<SpotifyAlbumObject>(
      `/v1/artists/${artistId}/albums`,
      params,
    );
    for (const raw of page.items) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      albums.push({
        id: raw.id,
        artistId,
        name: raw.name,
        albumGroup: normalizeGroup(raw.album_group, raw.album_type),
        releaseDate: raw.release_date,
        totalTracks: raw.total_tracks,
        images: raw.images,
        excluded: false,
        tracksSyncedAt: null,
      });
    }
    offset += page.items.length;
    if (!page.next || page.items.length === 0) break;
  }
  return albums;
}

export async function getAlbumTracks(
  albumId: string,
  artistId: string,
): Promise<Track[]> {
  const tracks: Track[] = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      market: CATALOG_MARKET,
      limit: String(CATALOG_PAGE_SIZE),
      offset: String(offset),
    });
    const page = await fetchPage<SpotifyTrackObject>(
      `/v1/albums/${albumId}/tracks`,
      params,
    );
    for (const raw of page.items) {
      tracks.push({
        id: raw.id,
        albumId,
        artistId,
        name: raw.name,
        discNumber: raw.disc_number,
        trackNumber: raw.track_number,
        durationMs: raw.duration_ms,
        status: 'none',
      });
    }
    offset += page.items.length;
    if (!page.next || page.items.length === 0) break;
  }
  return tracks;
}

/** Personalization endpoint, untouched by the catalog limit changes. */
const RECENTLY_PLAYED_LIMIT = 50;

export async function getRecentlyPlayed(): Promise<RecentlyPlayedItem[]> {
  const data = await spotifyFetch<{ items: RecentlyPlayedItem[] }>(
    `/v1/me/player/recently-played?limit=${RECENTLY_PLAYED_LIMIT}`,
  );
  return data.items;
}

export function spotifyAlbumUrl(albumId: string): string {
  return `https://open.spotify.com/album/${albumId}`;
}

export function spotifyArtistUrl(artistId: string): string {
  return `https://open.spotify.com/artist/${artistId}`;
}
