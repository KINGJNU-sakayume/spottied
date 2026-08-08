import type { Album, AlbumGroup, SpotifyImage, Track } from '../../types';
import { spotifyFetch } from './client';

interface Paging<T> {
  items: T[];
  next: string | null;
  total: number;
}

export interface SpotifyArtistObject {
  id: string;
  name: string;
  images: SpotifyImage[];
  genres: string[];
  followers?: { total: number };
}

interface SpotifyAlbumObject {
  id: string;
  name: string;
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

export interface RecentlyPlayedItem {
  track: {
    id: string;
    name: string;
    duration_ms: number;
    album: { id: string; name: string; images: SpotifyImage[] };
    artists: Array<{ id: string; name: string }>;
  };
  played_at: string;
}

export async function searchArtists(query: string): Promise<SpotifyArtistObject[]> {
  const params = new URLSearchParams({
    q: query,
    type: 'artist',
    market: 'KR',
    limit: '20',
  });
  const data = await spotifyFetch<{ artists: Paging<SpotifyArtistObject> }>(
    `/v1/search?${params.toString()}`,
  );
  return data.artists.items;
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
      market: 'KR',
      limit: '50',
      offset: String(offset),
    });
    const page = await spotifyFetch<Paging<SpotifyAlbumObject>>(
      `/v1/artists/${artistId}/albums?${params.toString()}`,
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
      market: 'KR',
      limit: '50',
      offset: String(offset),
    });
    const page = await spotifyFetch<Paging<SpotifyTrackObject>>(
      `/v1/albums/${albumId}/tracks?${params.toString()}`,
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

export async function getRecentlyPlayed(): Promise<RecentlyPlayedItem[]> {
  const data = await spotifyFetch<{ items: RecentlyPlayedItem[] }>(
    '/v1/me/player/recently-played?limit=50',
  );
  return data.items;
}

export function spotifyAlbumUrl(albumId: string): string {
  return `https://open.spotify.com/album/${albumId}`;
}

export function spotifyArtistUrl(artistId: string): string {
  return `https://open.spotify.com/artist/${artistId}`;
}
