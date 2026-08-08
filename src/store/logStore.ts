import { create } from 'zustand';
import { db } from '../db/dexie';
import type { ListenEvent } from '../types';

interface LogState {
  loaded: boolean;
  events: ListenEvent[];
  loadAll: () => Promise<void>;
  addEvent: (event: ListenEvent) => Promise<void>;
  addEvents: (events: ListenEvent[]) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  /** Bulk counterpart of removeEvent — one transaction, one re-render. */
  removeEvents: (ids: string[]) => Promise<void>;
  /** Idempotent re-insert of a previously deleted event (undo). */
  restoreEvents: (events: ListenEvent[]) => Promise<void>;
  hasEvent: (trackId: string, listenedAt: string) => boolean;
}

export const useLogStore = create<LogState>((set, get) => ({
  loaded: false,
  events: [],

  loadAll: async () => {
    const events = await db.listenEvents.toArray();
    set({ events, loaded: true });
  },

  addEvent: async (event) => {
    await db.listenEvents.add(event);
    set((s) => ({ events: [...s.events, event] }));
  },

  addEvents: async (events) => {
    if (events.length === 0) return;
    await db.listenEvents.bulkAdd(events);
    set((s) => ({ events: [...s.events, ...events] }));
  },

  removeEvent: async (id) => {
    await db.listenEvents.delete(id);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  },

  removeEvents: async (ids) => {
    if (ids.length === 0) return;
    await db.listenEvents.bulkDelete(ids);
    const drop = new Set(ids);
    set((s) => ({ events: s.events.filter((e) => !drop.has(e.id)) }));
  },

  // `put`, not `add`: undo can be triggered twice (toast tap plus a stale
  // handler) and `add` would reject with ConstraintError, desyncing the store.
  restoreEvents: async (events) => {
    if (events.length === 0) return;
    await db.listenEvents.bulkPut(events);
    set((s) => {
      const known = new Set(s.events.map((e) => e.id));
      const missing = events.filter((e) => !known.has(e.id));
      return missing.length === 0 ? s : { events: [...s.events, ...missing] };
    });
  },

  hasEvent: (trackId, listenedAt) =>
    get().events.some((e) => e.trackId === trackId && e.listenedAt === listenedAt),
}));
