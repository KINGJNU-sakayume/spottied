import { useState } from 'react';
import { dayKeyOf } from '../utils/format';

/**
 * Picks a past date for a retroactive listen. Registering an album you dug
 * through years ago otherwise stamps everything with today, which skews the
 * heatmap and can invent a streak that never happened.
 */
export function BackdateDialog({
  title,
  onConfirm,
  onClose,
}: {
  title: string;
  /** ISO timestamp at local noon of the chosen day. */
  onConfirm: (listenedAt: string) => void;
  onClose: () => void;
}) {
  const today = dayKeyOf(new Date());
  const [day, setDay] = useState(today);

  const submit = () => {
    if (!day || day > today) return;
    const [y, m, d] = day.split('-').map(Number);
    // Local noon keeps the date on the intended side of every timezone edge.
    onConfirm(new Date(y, m - 1, d, 12, 0, 0).toISOString());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="glass-scrim fade-in absolute inset-0" onClick={onClose} aria-hidden />
      <div className="sheet-in glass-bar absolute inset-x-0 bottom-0 rounded-t-[28px] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:left-1/2 md:top-24 md:w-[22rem] md:-translate-x-1/2 md:rounded-[28px]">
        <h2 className="text-base font-bold">다른 날짜로 기록</h2>
        <p className="mt-0.5 truncate text-sm text-ink/50">{title}</p>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => setDay(e.target.value)}
          className="glass-inset mt-4 w-full rounded-[18px] px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-ink/15"
        />
        <p className="mt-2 text-xs text-ink/40">미래 날짜는 기록할 수 없어요.</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="glass-inset flex-1 rounded-full py-3 text-sm font-semibold text-ink/65"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            disabled={!day || day > today}
            className="flex-1 rounded-full bg-ink py-3 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-30"
            onClick={submit}
          >
            기록
          </button>
        </div>
      </div>
    </div>
  );
}
