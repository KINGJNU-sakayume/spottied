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
    <div className="border-b border-white/5 py-2 last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className="w-6 shrink-0 text-right text-sm tabular-nums text-white/40">
          {track.trackNumber}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm',
              listened && 'text-white',
              skipped && 'text-white/35 line-through',
              !listened && !skipped && 'text-white/80',
            )}
          >
            {track.name}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-white/40">
            <span className="tabular-nums">{formatDurationMs(track.durationMs)}</span>
            {track.note && <span className="truncate italic">“{track.note}”</span>}
          </div>
        </div>

        <StarRating
          size={13}
          value={track.rating}
          onChange={(v) => void updateTrack(track.id, { rating: v })}
        />

        <button
          type="button"
          aria-label={track.likedAt ? '좋아요 해제' : '좋아요'}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
            track.likedAt ? 'text-rose-400' : 'text-white/30 hover:text-white/60',
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
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200',
            listened
              ? 'text-base'
              : skipped
                ? 'bg-white/10 text-white/40'
                : 'bg-white/10 text-white/60 hover:bg-white/20',
          )}
          style={listened ? { background: accent ?? 'rgba(255,255,255,0.9)', color: '#0b0b0f' } : undefined}
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
            className="flex h-8 w-6 items-center justify-center text-white/35 hover:text-white/70"
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
              <div className="glass fade-in absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-xl py-1 text-sm">
                {!skipped && (
                  <button
                    type="button"
                    className="block w-full px-4 py-2.5 text-left hover:bg-white/10"
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
                    className="block w-full px-4 py-2.5 text-left hover:bg-white/10"
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
                  className="block w-full px-4 py-2.5 text-left hover:bg-white/10"
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
            className="min-w-0 flex-1 resize-none rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder-white/30 outline-none ring-1 ring-inset ring-white/10 focus:ring-white/30"
          />
          <button
            type="button"
            className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25"
            onClick={saveNote}
          >
            저장
          </button>
        </div>
      )}
    </div>
  );
}
