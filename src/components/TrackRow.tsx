import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { useArtistStore } from '../store/artistStore';
import type { Track } from '../types';
import { cn } from '../utils/cn';
import { CheckIcon, CircleIcon, HeartIcon, SkipIcon } from './Icons';
import { OverflowMenu, type OverflowMenuItem } from './OverflowMenu';
import { StarRating } from './StarRating';

/**
 * Per-track digging controls. The status control is a checkbox, not a
 * transport control: tapping toggles 미청취 ↔ 청취 so a mis-tap undoes
 * itself. Deliberate re-listens live in the overflow menu, alongside skip,
 * revert and the note editor (also reachable by long-press).
 */
export function TrackRow({ track }: { track: Track }) {
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
    // Toggle, so an accidental tap is undone by tapping again.
    if (track.status === 'listened') {
      void setTrackStatus(track.id, 'none');
    } else {
      void markListened(track.id);
    }
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

  const menuItems: OverflowMenuItem[] = [
    // Tapping the checkbox now toggles, so a deliberate re-listen needs its
    // own explicit action.
    ...(listened
      ? [{ label: '재청취 기록', onSelect: () => void markListened(track.id) }]
      : []),
    ...(skipped
      ? []
      : [
          {
            label: '스킵 처리',
            onSelect: () => void setTrackStatus(track.id, 'skipped'),
          },
        ]),
    ...(track.status === 'none'
      ? []
      : [
          {
            label: '미청취로 되돌리기',
            onSelect: () => void setTrackStatus(track.id, 'none'),
          },
        ]),
    {
      label: track.note ? '메모 수정' : '메모 추가',
      onSelect: () => {
        setNoteDraft(track.note ?? '');
        setNoteOpen(true);
      },
    },
  ];

  return (
    <div className="border-b border-ink/[0.07] py-2 last:border-b-0">
      <div className="flex items-center gap-2">
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
          {track.note && (
            <p className="mt-0.5 truncate text-xs italic text-ink/40">
              “{track.note}”
            </p>
          )}
        </div>

        {/*
          Rating gets its own fixed column instead of sharing a meta line with
          the runtime. The runtime is gone: in a digging tracker it carries
          almost no information, and the space it held is what makes a
          touchable 16px star row fit.
        */}
        <StarRating
          size={16}
          value={track.rating}
          onChange={(v) => void updateTrack(track.id, { rating: v })}
          className="shrink-0"
        />

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
          role="checkbox"
          aria-checked={listened}
          aria-label={listened ? '청취 취소' : '청취 처리'}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-200 active:scale-95',
            listened
              ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-inset ring-white/25'
              : skipped
                ? 'bg-ink/[0.06] text-ink/30 ring-1 ring-inset ring-ink/[0.06]'
                : 'text-ink/30 hover:text-ink/55',
          )}
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
            <CircleIcon size={20} />
          )}
        </button>

        <OverflowMenu
          label="트랙 메뉴"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          items={menuItems}
        />
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
