import { create } from 'zustand';
import { db } from '../db/dexie';
import { enqueueSpotifyTask } from '../lib/spotify/client';
import * as api from '../lib/spotify/endpoints';
import type {
  Album,
  Artist,
  ArtistScope,
  ListenEvent,
  ListenSource,
  Track,
} from '../types';
import { getAlbumProgress, getArtistStatus } from '../utils/derive';
import { useLogStore } from './logStore';
import { useUiStore } from './uiStore';

interface CompletionSnapshot {
  albumId: string;
  artistId: string;
  albumComplete: boolean;
  artistCompleted: boolean;
}

interface ArtistState {
  loaded: boolean;
  artists: Record<string, Artist>;
  albums: Record<string, Album>;
  tracks: Record<string, Track>;
  loadingTrackAlbums: Record<string, boolean>;
  importingArtistIds: Record<string, boolean>;

  loadAll: () => Promise<void>;
  addArtist: (spotifyArtist: api.SpotifyArtistObject) => Promise<void>;
  refreshDiscography: (artistId: string) => Promise<void>;
  ensureAlbumTracks: (albumId: string, force?: boolean) => Promise<void>;
  setScope: (artistId: string, scope: ArtistScope) => Promise<void>;
  setAlbumExcluded: (albumId: string, excluded: boolean) => Promise<void>;
  markListened: (
    trackId: string,
    opts?: { listenedAt?: string; source?: ListenSource },
  ) => Promise<void>;
  setTrackStatus: (trackId: string, status: 'none' | 'skipped') => Promise<void>;
  markAlbumListened: (albumId: string) => Promise<void>;
  updateTrack: (trackId: string, patch: Partial<Track>) => Promise<void>;
  updateAlbum: (albumId: string, patch: Partial<Album>) => Promise<void>;
  updateArtist: (artistId: string, patch: Partial<Artist>) => Promise<void>;
}

function albumTracksOf(tracks: Record<string, Track>, albumId: string): Track[] {
  return Object.values(tracks).filter((t) => t.albumId === albumId);
}

function tracksByAlbumOf(
  tracks: Record<string, Track>,
): Record<string, Track[]> {
  const out: Record<string, Track[]> = {};
  for (const t of Object.values(tracks)) {
    (out[t.albumId] ??= []).push(t);
  }
  return out;
}

export const useArtistStore = create<ArtistState>((set, get) => {
  function snapshotCompletion(albumId: string, artistId: string): CompletionSnapshot {
    const { artists, albums, tracks } = get();
    const album = albums[albumId];
    const artist = artists[artistId];
    const byAlbum = tracksByAlbumOf(tracks);
    return {
      albumId,
      artistId,
      albumComplete: album
        ? getAlbumProgress(album, byAlbum[albumId] ?? []).complete
        : false,
      artistCompleted: artist
        ? getArtistStatus(artist, Object.values(albums), byAlbum) === 'completed'
        : false,
    };
  }

  function toastOnNewCompletion(before: CompletionSnapshot): void {
    const after = snapshotCompletion(before.albumId, before.artistId);
    const { albums, artists } = get();
    const pushToast = useUiStore.getState().pushToast;
    if (!before.albumComplete && after.albumComplete) {
      const album = albums[before.albumId];
      if (album) pushToast(`『${album.name}』 완료`);
    }
    if (!before.artistCompleted && after.artistCompleted) {
      const artist = artists[before.artistId];
      if (artist) pushToast(`${artist.name} 완주 🏆`, true);
    }
  }

  return {
    loaded: false,
    artists: {},
    albums: {},
    tracks: {},
    loadingTrackAlbums: {},
    importingArtistIds: {},

    loadAll: async () => {
      const [artists, albums, tracks] = await Promise.all([
        db.artists.toArray(),
        db.albums.toArray(),
        db.tracks.toArray(),
      ]);
      set({
        artists: Object.fromEntries(artists.map((a) => [a.id, a])),
        albums: Object.fromEntries(albums.map((a) => [a.id, a])),
        tracks: Object.fromEntries(tracks.map((t) => [t.id, t])),
        loaded: true,
      });
    },

    addArtist: async (spotifyArtist) => {
      const { artists, importingArtistIds } = get();
      if (artists[spotifyArtist.id] || importingArtistIds[spotifyArtist.id]) return;
      set((s) => ({
        importingArtistIds: { ...s.importingArtistIds, [spotifyArtist.id]: true },
      }));
      try {
        const detail = await api.getArtist(spotifyArtist.id);
        const now = new Date().toISOString();
        const artist: Artist = {
          id: detail.id,
          name: detail.name,
          images: detail.images,
          // genres is deprecated and may be absent; normalize at the boundary.
          genres: detail.genres ?? [],
          addedAt: now,
          scope: { album: true, single: true, compilation: false },
          discographySyncedAt: now,
        };
        const albums = await api.getArtistAlbums(detail.id);
        await db.transaction('rw', db.artists, db.albums, async () => {
          await db.artists.put(artist);
          await db.albums.bulkPut(albums);
        });
        set((s) => ({
          artists: { ...s.artists, [artist.id]: artist },
          albums: {
            ...s.albums,
            ...Object.fromEntries(albums.map((a) => [a.id, a])),
          },
        }));
      } finally {
        set((s) => {
          const next = { ...s.importingArtistIds };
          delete next[spotifyArtist.id];
          return { importingArtistIds: next };
        });
      }
    },

    refreshDiscography: async (artistId) => {
      const artist = get().artists[artistId];
      if (!artist) return;
      const detail = await api.getArtist(artistId);
      const fetched = await api.getArtistAlbums(artistId);
      const existing = get().albums;
      // Merge: keep user state (exclusion, rating, notes, cached tracks) on
      // albums we already know; add newly released ones.
      const merged = fetched.map((al) => {
        const prev = existing[al.id];
        return prev
          ? {
              ...al,
              excluded: prev.excluded,
              tracksSyncedAt: prev.tracksSyncedAt,
              rating: prev.rating,
              likedAt: prev.likedAt,
              note: prev.note,
            }
          : al;
      });
      const updatedArtist: Artist = {
        ...artist,
        name: detail.name,
        images: detail.images,
        genres: detail.genres ?? artist.genres,
        discographySyncedAt: new Date().toISOString(),
      };
      await db.transaction('rw', db.artists, db.albums, async () => {
        await db.artists.put(updatedArtist);
        await db.albums.bulkPut(merged);
      });
      set((s) => ({
        artists: { ...s.artists, [artistId]: updatedArtist },
        albums: {
          ...s.albums,
          ...Object.fromEntries(merged.map((a) => [a.id, a])),
        },
      }));
    },

    ensureAlbumTracks: async (albumId, force = false) => {
      const { albums, loadingTrackAlbums } = get();
      const album = albums[albumId];
      if (!album) return;
      if (loadingTrackAlbums[albumId]) return;
      if (album.tracksSyncedAt && !force) return;
      set((s) => ({
        loadingTrackAlbums: { ...s.loadingTrackAlbums, [albumId]: true },
      }));
      try {
        // Sequential queue — never fetch album tracks in parallel bursts.
        const fetched = await enqueueSpotifyTask(() =>
          api.getAlbumTracks(albumId, album.artistId),
        );
        const existing = get().tracks;
        const merged = fetched.map((t) => {
          const prev = existing[t.id];
          return prev
            ? {
                ...t,
                status: prev.status,
                rating: prev.rating,
                likedAt: prev.likedAt,
                note: prev.note,
              }
            : t;
        });
        const updatedAlbum: Album = {
          ...get().albums[albumId],
          tracksSyncedAt: new Date().toISOString(),
          totalTracks: merged.length,
        };
        await db.transaction('rw', db.albums, db.tracks, async () => {
          await db.albums.put(updatedAlbum);
          await db.tracks.bulkPut(merged);
        });
        set((s) => ({
          albums: { ...s.albums, [albumId]: updatedAlbum },
          tracks: {
            ...s.tracks,
            ...Object.fromEntries(merged.map((t) => [t.id, t])),
          },
        }));
      } finally {
        set((s) => {
          const next = { ...s.loadingTrackAlbums };
          delete next[albumId];
          return { loadingTrackAlbums: next };
        });
      }
    },

    setScope: async (artistId, scope) => {
      const artist = get().artists[artistId];
      if (!artist) return;
      const updated = { ...artist, scope };
      await db.artists.put(updated);
      set((s) => ({ artists: { ...s.artists, [artistId]: updated } }));
    },

    setAlbumExcluded: async (albumId, excluded) => {
      const album = get().albums[albumId];
      if (!album) return;
      const before = snapshotCompletion(albumId, album.artistId);
      const updated = { ...album, excluded };
      await db.albums.put(updated);
      set((s) => ({ albums: { ...s.albums, [albumId]: updated } }));
      toastOnNewCompletion(before);
    },

    markListened: async (trackId, opts = {}) => {
      const track = get().tracks[trackId];
      if (!track) return;
      const before = snapshotCompletion(track.albumId, track.artistId);
      const updated: Track = { ...track, status: 'listened' };
      await db.tracks.put(updated);
      set((s) => ({ tracks: { ...s.tracks, [trackId]: updated } }));
      const event: ListenEvent = {
        id: crypto.randomUUID(),
        trackId,
        albumId: track.albumId,
        artistId: track.artistId,
        listenedAt: opts.listenedAt ?? new Date().toISOString(),
        source: opts.source ?? 'manual',
      };
      await useLogStore.getState().addEvent(event);
      if (track.status === 'listened') {
        useUiStore.getState().pushToast('재청취를 기록했어요');
      }
      toastOnNewCompletion(before);
    },

    setTrackStatus: async (trackId, status) => {
      const track = get().tracks[trackId];
      if (!track) return;
      const before = snapshotCompletion(track.albumId, track.artistId);
      const updated: Track = { ...track, status };
      await db.tracks.put(updated);
      set((s) => ({ tracks: { ...s.tracks, [trackId]: updated } }));
      toastOnNewCompletion(before);
    },

    markAlbumListened: async (albumId) => {
      const { tracks, albums } = get();
      const album = albums[albumId];
      if (!album) return;
      const before = snapshotCompletion(albumId, album.artistId);
      const targets = albumTracksOf(tracks, albumId).filter(
        (t) => t.status !== 'listened',
      );
      if (targets.length === 0) return;
      const now = new Date().toISOString();
      const updatedTracks = targets.map(
        (t): Track => ({ ...t, status: 'listened' }),
      );
      const events = targets.map(
        (t): ListenEvent => ({
          id: crypto.randomUUID(),
          trackId: t.id,
          albumId,
          artistId: t.artistId,
          listenedAt: now,
          source: 'manual',
        }),
      );
      await db.tracks.bulkPut(updatedTracks);
      set((s) => ({
        tracks: {
          ...s.tracks,
          ...Object.fromEntries(updatedTracks.map((t) => [t.id, t])),
        },
      }));
      await useLogStore.getState().addEvents(events);
      toastOnNewCompletion(before);
    },

    updateTrack: async (trackId, patch) => {
      const track = get().tracks[trackId];
      if (!track) return;
      const updated = { ...track, ...patch };
      await db.tracks.put(updated);
      set((s) => ({ tracks: { ...s.tracks, [trackId]: updated } }));
    },

    updateAlbum: async (albumId, patch) => {
      const album = get().albums[albumId];
      if (!album) return;
      const updated = { ...album, ...patch };
      await db.albums.put(updated);
      set((s) => ({ albums: { ...s.albums, [albumId]: updated } }));
    },

    updateArtist: async (artistId, patch) => {
      const artist = get().artists[artistId];
      if (!artist) return;
      const updated = { ...artist, ...patch };
      await db.artists.put(updated);
      set((s) => ({ artists: { ...s.artists, [artistId]: updated } }));
    },
  };
});
