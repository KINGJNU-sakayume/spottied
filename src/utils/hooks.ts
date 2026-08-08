import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import type { Artist, Track } from '../types';
import { getArtistStatus, type TracksByAlbum } from './derive';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)');
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function useTracksByAlbum(): TracksByAlbum {
  const tracks = useArtistStore((s) => s.tracks);
  return useMemo(() => {
    const out: Record<string, Track[]> = {};
    for (const t of Object.values(tracks)) {
      (out[t.albumId] ??= []).push(t);
    }
    return out;
  }, [tracks]);
}

/**
 * Navigates to /album/:id. On mobile the album route renders as a bottom
 * sheet over the current page (real route — back/edge-swipe closes it).
 */
export interface DiggingGroups {
  inProgress: Artist[];
  completed: Artist[];
  notStarted: Artist[];
  /** Most recent listen per artist, falling back to when they were added. */
  recencyOf: (artist: Artist) => string;
}

/**
 * Artists bucketed by dig status, each bucket most-recently-touched first.
 * Home and NowDiggingBar both need exactly this, and used to derive it twice.
 */
export function useDiggingGroups(): DiggingGroups {
  const artists = useArtistStore((s) => s.artists);
  const albums = useArtistStore((s) => s.albums);
  const events = useLogStore((s) => s.events);
  const tracksByAlbum = useTracksByAlbum();

  return useMemo(() => {
    const albumList = Object.values(albums);
    const lastListen = new Map<string, string>();
    for (const e of events) {
      const prev = lastListen.get(e.artistId);
      if (!prev || e.listenedAt > prev) lastListen.set(e.artistId, e.listenedAt);
    }
    const inProgress: Artist[] = [];
    const completed: Artist[] = [];
    const notStarted: Artist[] = [];
    for (const artist of Object.values(artists)) {
      const status = getArtistStatus(artist, albumList, tracksByAlbum);
      if (status === 'in-progress') inProgress.push(artist);
      else if (status === 'completed') completed.push(artist);
      else notStarted.push(artist);
    }
    const recencyOf = (a: Artist) => lastListen.get(a.id) ?? a.addedAt;
    inProgress.sort((a, b) => recencyOf(b).localeCompare(recencyOf(a)));
    completed.sort((a, b) => recencyOf(b).localeCompare(recencyOf(a)));
    notStarted.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return { inProgress, completed, notStarted, recencyOf };
  }, [artists, albums, events, tracksByAlbum]);
}

/**
 * The `state` a <Link> to /album/:id needs to get the same mobile bottom-sheet
 * presentation useOpenAlbum gives, while staying a real anchor (keyboard,
 * middle-click, focus order).
 */
export function useAlbumLinkState(): { background: Location } | undefined {
  const location = useLocation();
  const isMobile = useIsMobile();
  return isMobile ? { background: location } : undefined;
}

export function useOpenAlbum(): (albumId: string) => void {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  return (albumId: string) => {
    navigate(`/album/${albumId}`, {
      state: isMobile ? { background: location } : undefined,
    });
  };
}
