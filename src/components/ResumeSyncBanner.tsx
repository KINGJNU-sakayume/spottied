import { useCallback, useEffect, useState } from 'react';
import { useArtistStore } from '../store/artistStore';
import { useLogStore } from '../store/logStore';
import { useRecentStore } from '../store/recentStore';
import { SyncReviewSheet } from './SyncReviewSheet';

const MIN_REFRESH_AGE_MS = 60_000;

/**
 * Closes the Spotify round trip. Listening happens in Spotify, so returning
 * to this tab is the one moment we know new plays might exist — previously
 * the user had to remember to press 가져오기 themselves.
 *
 * Only visibilitychange triggers it. No polling: the app is idle in a
 * background tab most of the time, and a timer would spend quota on nothing.
 */
export function ResumeSyncBanner() {
  const refresh = useRecentStore((s) => s.refresh);
  const items = useRecentStore((s) => s.items);
  const hasEvent = useLogStore((s) => s.hasEvent);
  const tracks = useArtistStore((s) => s.tracks);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh(MIN_REFRESH_AGE_MS);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // Same filter SyncReviewSheet applies, so the count matches what the sheet
  // will actually offer: a locally known track, unheard, not already logged.
  const unlogged = items.filter((item) => {
    const track = tracks[item.track.id];
    if (!track || track.status !== 'none') return false;
    if (hasEvent(item.track.id, item.played_at)) return false;
    return dismissedAt == null || item.played_at > dismissedAt;
  });

  const latestPlayedAt = items.reduce(
    (max, i) => (i.played_at > max ? i.played_at : max),
    '',
  );

  const onLater = useCallback(() => {
    // Remember how far we've seen, so the banner stays gone until genuinely
    // newer plays show up.
    setDismissedAt(latestPlayedAt);
  }, [latestPlayedAt]);

  if (sheetOpen) {
    return (
      <SyncReviewSheet
        onClose={() => {
          setSheetOpen(false);
          setDismissedAt(latestPlayedAt);
        }}
      />
    );
  }

  if (unlogged.length === 0) return null;

  return (
    <div className="glass-bar fade-in fixed inset-x-3 top-3 z-40 flex items-center gap-3 rounded-[20px] p-3 lg:left-[15rem] lg:right-4">
      <p className="min-w-0 flex-1 text-sm font-medium text-ink/75">
        방금 {unlogged.length}곡 들으셨네요 — 기록할까요?
      </p>
      <button
        type="button"
        className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95"
        onClick={() => setSheetOpen(true)}
      >
        기록
      </button>
      <button
        type="button"
        className="shrink-0 text-sm text-ink/40 hover:text-ink/70"
        onClick={onLater}
      >
        나중에
      </button>
    </div>
  );
}
