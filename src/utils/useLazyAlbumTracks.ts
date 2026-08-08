import { useCallback, useEffect, useRef } from 'react';
import { useArtistStore } from '../store/artistStore';
import { createFetchQueue, type FetchQueue } from './fetchQueue';

export type TileRef = (el: HTMLElement | null) => void;

/**
 * Fetches an album's tracks when its tile scrolls into view, so a grid of
 * covers can show real progress without fetching the whole discography up
 * front. Admission is capped (see createFetchQueue) to keep speculative work
 * from starving user-initiated requests.
 */
export function useLazyAlbumTracks(opts: {
  /** Clears all bookkeeping when it changes — pass the artist id. */
  resetKey: string;
  /** Pass `online && connected`; nothing is observed while false. */
  enabled?: boolean;
  maxInFlight?: number;
  rootMargin?: string;
}): { observe: (albumId: string) => TileRef } {
  const {
    resetKey,
    enabled = true,
    maxInFlight = 3,
    rootMargin = '300px 0px',
  } = opts;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const queueRef = useRef<FetchQueue | null>(null);
  const albumByEl = useRef(new Map<Element, string>());
  const elByAlbum = useRef(new Map<string, Element>());
  const refCache = useRef(new Map<string, TileRef>());

  useEffect(() => {
    if (!enabled) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const queue = createFetchQueue({
      maxInFlight,
      run: (albumId) => useArtistStore.getState().ensureAlbumTracks(albumId),
    });
    queueRef.current = queue;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const albumId = albumByEl.current.get(entry.target);
          if (albumId == null) continue;
          // One shot per tile: scrolling back up must not re-request.
          observer.unobserve(entry.target);
          albumByEl.current.delete(entry.target);
          elByAlbum.current.delete(albumId);
          queue.push(albumId);
        }
      },
      { rootMargin, threshold: 0 },
    );
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      queue.stop();
      observerRef.current = null;
      queueRef.current = null;
      albumByEl.current.clear();
      elByAlbum.current.clear();
      refCache.current.clear();
    };
  }, [resetKey, enabled, maxInFlight, rootMargin]);

  // The returned callback must be stable per album: a fresh function each
  // render makes React detach and reattach every ref on every render, which
  // would churn observe/unobserve across the whole grid.
  const observe = useCallback((albumId: string): TileRef => {
    const cached = refCache.current.get(albumId);
    if (cached) return cached;
    const ref: TileRef = (el) => {
      const observer = observerRef.current;
      if (!observer) return;
      if (el == null) {
        const prev = elByAlbum.current.get(albumId);
        if (prev) {
          observer.unobserve(prev);
          albumByEl.current.delete(prev);
          elByAlbum.current.delete(albumId);
        }
        return;
      }
      if (useArtistStore.getState().albums[albumId]?.tracksSyncedAt) return;
      albumByEl.current.set(el, albumId);
      elByAlbum.current.set(albumId, el);
      observer.observe(el);
    };
    refCache.current.set(albumId, ref);
    return ref;
  }, []);

  return { observe };
}
