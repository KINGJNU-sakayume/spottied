import { create } from 'zustand';
import { db } from '../db/dexie';
import { hasTokens } from '../lib/spotify/client';
import { getRecentlyPlayed } from '../lib/spotify/endpoints';
import type { RecentlyPlayedCache, RecentlyPlayedItem } from '../types';

const CACHE_ID = 'latest' as const;

interface RecentState {
  loaded: boolean;
  items: RecentlyPlayedItem[];
  fetchedAt: string | null;
  refreshing: boolean;
  loadCache: () => Promise<void>;
  /**
   * Fetches and persists, unless a fetch is in flight, we are offline or
   * unauthenticated, or the cache is younger than `minAgeMs`. Resolves to
   * whether new data was stored. Never throws — a failed refresh just leaves
   * the cache in place.
   */
  refresh: (minAgeMs?: number) => Promise<boolean>;
}

export const useRecentStore = create<RecentState>((set, get) => ({
  loaded: false,
  items: [],
  fetchedAt: null,
  refreshing: false,

  loadCache: async () => {
    const row = await db.recentlyPlayedCache.get(CACHE_ID);
    set({
      items: row?.items ?? [],
      fetchedAt: row?.fetchedAt ?? null,
      loaded: true,
    });
  },

  refresh: async (minAgeMs = 60_000) => {
    const { refreshing, fetchedAt } = get();
    if (refreshing) return false;
    if (!navigator.onLine || !hasTokens()) return false;
    if (fetchedAt && Date.now() - new Date(fetchedAt).getTime() < minAgeMs) {
      return false;
    }
    set({ refreshing: true });
    try {
      const items = await getRecentlyPlayed();
      const row: RecentlyPlayedCache = {
        id: CACHE_ID,
        fetchedAt: new Date().toISOString(),
        items,
      };
      await db.recentlyPlayedCache.put(row);
      set({ items, fetchedAt: row.fetchedAt });
      return true;
    } catch {
      // Offline, expired token, quota — the cached shelf stays readable.
      return false;
    } finally {
      set({ refreshing: false });
    }
  },
}));
