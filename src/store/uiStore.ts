import { create } from 'zustand';
import { hasTokens } from '../lib/spotify/client';

export interface ToastItem {
  id: number;
  message: string;
  grand?: boolean;
}

interface UiState {
  toasts: ToastItem[];
  /** Non-blocking auth banner text; null hides the banner. */
  authNotice: string | null;
  spotifyConnected: boolean;
  pushToast: (message: string, grand?: boolean) => void;
  dismissToast: (id: number) => void;
  setAuthNotice: (message: string | null) => void;
  refreshConnected: () => void;
}

let nextToastId = 1;

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  authNotice: null,
  spotifyConnected: hasTokens(),

  pushToast: (message, grand = false) => {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, grand }] }));
    setTimeout(() => get().dismissToast(id), grand ? 4200 : 3000);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setAuthNotice: (message) => {
    set({ authNotice: message, spotifyConnected: hasTokens() });
  },

  refreshConnected: () => {
    set({ spotifyConnected: hasTokens() });
  },
}));
