import { create } from 'zustand';
import { hasTokens } from '../lib/spotify/client';

/** Inline button on a toast — the undo affordance for destructive actions. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Larger celebratory variant (완주 🏆). */
  grand?: boolean;
  /** Adding an action lengthens the default lifetime to 6s. */
  action?: ToastAction;
  /** Explicit lifetime override in ms. */
  durationMs?: number;
}

export interface ToastItem {
  id: number;
  message: string;
  grand?: boolean;
  action?: ToastAction;
}

interface UiState {
  toasts: ToastItem[];
  /** Non-blocking auth banner text; null hides the banner. */
  authNotice: string | null;
  spotifyConnected: boolean;
  /**
   * `true` is accepted as shorthand for `{ grand: true }` so the older boolean
   * form keeps working. Returns the toast id so a caller can dismiss early.
   */
  pushToast: (message: string, options?: boolean | ToastOptions) => number;
  dismissToast: (id: number) => void;
  setAuthNotice: (message: string | null) => void;
  refreshConnected: () => void;
}

const TOAST_MS = { normal: 3000, grand: 4200, action: 6000 } as const;

let nextToastId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function normalizeToastOptions(
  options?: boolean | ToastOptions,
): ToastOptions {
  return typeof options === 'boolean' ? { grand: options } : (options ?? {});
}

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  authNotice: null,
  spotifyConnected: hasTokens(),

  pushToast: (message, options) => {
    const { grand = false, action, durationMs } = normalizeToastOptions(options);
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, grand, action }] }));
    const ms =
      durationMs ??
      (action ? TOAST_MS.action : grand ? TOAST_MS.grand : TOAST_MS.normal);
    timers.set(
      id,
      setTimeout(() => get().dismissToast(id), ms),
    );
    return id;
  },

  dismissToast: (id) => {
    // Clearing the timer matters for action toasts: tapping 실행 취소 removes
    // the toast immediately, and a live timer would then fire on a dead id.
    const timer = timers.get(id);
    if (timer != null) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  setAuthNotice: (message) => {
    set({ authNotice: message, spotifyConnected: hasTokens() });
  },

  refreshConnected: () => {
    set({ spotifyConnected: hasTokens() });
  },
}));
