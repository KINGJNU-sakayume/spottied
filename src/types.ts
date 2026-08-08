export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface ArtistScope {
  album: boolean;
  single: boolean;
  compilation: boolean;
}

export interface Artist {
  id: string; // spotify artist id (primary key)
  name: string;
  images: SpotifyImage[];
  genres: string[];
  addedAt: string; // ISO
  scope: ArtistScope; // default { album: true, single: true, compilation: false }
  discographySyncedAt: string | null;
  note?: string;
}

export type AlbumGroup = 'album' | 'single' | 'compilation';

export interface Album {
  id: string; // spotify album id
  artistId: string;
  name: string;
  albumGroup: AlbumGroup;
  releaseDate: string; // may be year-only; sort tolerant
  totalTracks: number;
  images: SpotifyImage[];
  excluded: boolean; // default false
  tracksSyncedAt: string | null;
  rating?: number; // 0.5–5.0 in 0.5 steps, independent of track ratings
  likedAt?: string;
  note?: string;
}

export type TrackStatus = 'none' | 'listened' | 'skipped';

export interface Track {
  id: string; // spotify track id
  albumId: string;
  artistId: string;
  name: string;
  discNumber: number;
  trackNumber: number;
  durationMs: number;
  status: TrackStatus;
  rating?: number; // 0.5–5.0 half steps
  likedAt?: string;
  note?: string;
}

export type ListenSource = 'manual' | 'spotify-sync';

export interface ListenEvent {
  id: string; // uuid
  trackId: string;
  albumId: string;
  artistId: string;
  listenedAt: string;
  source: ListenSource;
}

export type ArtistDigStatus = 'not-started' | 'in-progress' | 'completed';
