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

  hasEvent: (trackId, listenedAt) =>
    get().events.some((e) => e.trackId === trackId && e.listenedAt === listenedAt),
}));
