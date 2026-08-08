import { create } from 'zustand';
import { hasTokens } from '../lib/spotify/client';

export interface ToastItem {
  id: number;
  message: string;
  grand?: boolean;
}

interface UiState {
  toasts: ToastItem[];
  needsReconnect: boolean;
  spotifyConnected: boolean;
  pushToast: (message: string, grand?: boolean) => void;
  dismissToast: (id: number) => void;
  setNeedsReconnect: (v: boolean) => void;
  refreshConnected: () => void;
}

let nextToastId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  needsReconnect: false,
  spotifyConnected: hasTokens(),

  pushToast: (message, grand = false) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, grand }] }));
    setTimeout(() => get().dismissToast(id), grand ? 4200 : 3000);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setNeedsReconnect: (v) => {
    set({ needsReconnect: v });
    if (v) set({ spotifyConnected: hasTokens() });
  },

  refreshConnected: () => {
    set({ spotifyConnected: hasTokens() });
  },
}));
