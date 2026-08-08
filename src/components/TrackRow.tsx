import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useArtistStore } from '../store/artistStore';
import type { Track } from '../types';
import { cn } from '../utils/cn';
import { formatDurationMs } from '../utils/format';
import { CheckIcon, DotsIcon, HeartIcon, PlayIcon, SkipIcon } from './Icons';
import { StarRating } from './StarRating';

/**
 * Per-track digging controls: status (tap cycles 미청취→청취; re-tap logs a
 * re-listen; long-press or the overflow menu for skip/revert), heart,
 * half-star rating and a free-text note.
 */
export function TrackRow({ track, accent }: { track: Track; accent?: string }) {
  const markListened = useArtistStore((s) => s.markListened);
  const setTrackStatus = useArtistStore((s) => s.setTrackStatus);
  const updateTrack = useArtistStore((s) => s.updateTrack);

  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(track.note ?? '');
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const onStatusTap = () => {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    void markListened(track.id);
  };

  const startLongPress = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    longPressed.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const saveNote = () => {
    const note = noteDraft.trim();
    void updateTrack(track.id, { note: note === '' ? undefined : note });
    setNoteOpen(false);
  };

  const listened = track.status === 'listened';
  const skipped = track.status === 'skipped';

  return (
    <div className="border-b border-ink/[0.07] py-2 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className="w-6 shrink-0 text-right text-sm tabular-nums text-ink/35">
          {track.trackNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm',
              listened && 'font-medium text-ink',
              skipped && 'text-ink/30 line-through',
              !listened && !skipped && 'text-ink/75',
            )}
          >
            {track.name}
          </p>
          {/* Rating lives on the meta line so long titles keep their room. */}
          <div className="mt-1 flex items-center gap-2.5">
            <span className="text-xs tabular-nums text-ink/40">
              {formatDurationMs(track.durationMs)}
            </span>
            <StarRating
              size={12}
              value={track.rating}
              onChange={(v) => void updateTrack(track.id, { rating: v })}
            />
          </div>
          {track.note && (
            <p className="mt-0.5 truncate text-xs italic text-ink/40">
              “{track.note}”
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label={track.likedAt ? '좋아요 해제' : '좋아요'}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
            track.likedAt ? 'text-rose-500' : 'text-ink/25 hover:text-ink/50',
          )}
          onClick={() =>
            void updateTrack(track.id, {
              likedAt: track.likedAt ? undefined : new Date().toISOString(),
            })
          }
        >
          <HeartIcon size={16} filled={Boolean(track.likedAt)} />
        </button>

        <button
          type="button"
          aria-label={listened ? '재청취 기록' : '청취 처리'}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-inset transition-all duration-200 active:scale-95',
            listened
              ? 'text-white ring-white/25'
              : skipped
                ? 'bg-ink/[0.06] text-ink/30 ring-ink/[0.06]'
                : 'bg-white/80 text-ink/55 ring-ink/[0.08] hover:bg-white',
          )}
          style={listened ? { background: accent ?? 'rgba(29,29,31,0.85)' } : undefined}
          onClick={onStatusTap}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerMove={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen(true);
          }}
        >
          {listened ? (
            <CheckIcon size={15} />
          ) : skipped ? (
            <SkipIcon size={14} />
          ) : (
            <PlayIcon size={13} className="translate-x-[1px]" />
          )}
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="트랙 메뉴"
            className="flex h-8 w-6 items-center justify-center text-ink/30 hover:text-ink/60"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <DotsIcon size={16} />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div className="glass-bar fade-in absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-2xl py-1 text-sm">
                {!skipped && (
                  <button
                    type="button"
                    className="block w-full px-4 py-2.5 text-left hover:bg-ink/[0.05]"
                    onClick={() => {
                      setMenuOpen(false);
                      void setTrackStatus(track.id, 'skipped');
                    }}
                  >
                    스킵 처리
                  </button>
                )}
                {track.status !== 'none' && (
                  <button
                    type="button"
                    className="block w-full px-4 py-2.5 text-left hover:bg-ink/[0.05]"
                    onClick={() => {
                      setMenuOpen(false);
                      void setTrackStatus(track.id, 'none');
                    }}
                  >
                    미청취로 되돌리기
                  </button>
                )}
                <button
                  type="button"
                  className="block w-full px-4 py-2.5 text-left hover:bg-ink/[0.05]"
                  onClick={() => {
                    setMenuOpen(false);
                    setNoteDraft(track.note ?? '');
                    setNoteOpen(true);
                  }}
                >
                  {track.note ? '메모 수정' : '메모 추가'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {noteOpen && (
        <div className="fade-in mt-2 flex items-end gap-2 pl-8">
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={2}
            placeholder="메모"
            className="glass-inset min-w-0 flex-1 resize-none rounded-xl px-3 py-2 text-sm text-ink placeholder-ink/30 outline-none focus:ring-2 focus:ring-ink/15"
          />
          <button
            type="button"
            className="rounded-xl bg-ink px-3.5 py-2 text-sm font-semibold text-white transition-transform active:scale-95"
            onClick={saveNote}
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}
