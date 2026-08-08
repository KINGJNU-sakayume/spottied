import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { useArtistStore } from '../store/artistStore';
import type { Track } from '../types';
import type { TracksByAlbum } from './derive';

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
