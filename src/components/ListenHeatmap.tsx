import { useEffect, useMemo, useRef } from 'react';
import type { DayCount } from '../utils/derive';
import { cn } from '../utils/cn';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

/** Five steps, so a 12-listen day still reads louder than a 3-listen one. */
function levelOf(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 1) return 4;
  return Math.min(4, 1 + Math.floor((count / max) * 3.999));
}

const LEVEL_CLASS = [
  'bg-ink/[0.05]',
  'bg-emerald-500/25',
  'bg-emerald-500/45',
  'bg-emerald-500/70',
  'bg-emerald-500',
];

/**
 * Contribution-graph style year view. Hand-built on CSS grid rather than
 * Recharts: it is a fixed lattice of squares, and a charting library would
 * add layout maths and bundle weight for no benefit.
 */
export function ListenHeatmap({
  days,
  onSelectDay,
}: {
  days: DayCount[];
  onSelectDay?: (day: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { weeks, max, monthMarks } = useMemo(() => {
    if (days.length === 0) {
      return { weeks: [] as Array<Array<DayCount | null>>, max: 0, monthMarks: [] };
    }
    // Pad the first week so row position always equals the weekday.
    const lead = new Date(`${days[0].day}T12:00:00`).getDay();
    const cells: Array<DayCount | null> = [
      ...Array.from({ length: lead }, () => null),
      ...days,
    ];
    const weeks: Array<Array<DayCount | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    const marks: Array<{ index: number; label: string }> = [];
    let lastMonth = -1;
    weeks.forEach((week, index) => {
      const first = week.find((c): c is DayCount => c != null);
      if (!first) return;
      const month = Number(first.day.slice(5, 7)) - 1;
      if (month !== lastMonth) {
        marks.push({ index, label: MONTH_LABELS[month] });
        lastMonth = month;
      }
    });
    return {
      weeks,
      max: Math.max(...days.map((d) => d.count)),
      monthMarks: marks,
    };
  }, [days]);

  // A year is wider than a phone, and the interesting end is the recent one.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);

  if (weeks.length === 0) return null;

  return (
    <div ref={scrollerRef} className="no-scrollbar overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-1 pl-6">
          {weeks.map((_, i) => {
            const mark = monthMarks.find((m) => m.index === i);
            return (
              <span
                key={i}
                // Labels overflow their 11px column on purpose; without
                // nowrap "10월" breaks onto two lines.
                className="w-[11px] shrink-0 whitespace-nowrap text-[9px] leading-4 text-ink/35"
              >
                {mark ? mark.label : ''}
              </span>
            );
          })}
        </div>
        <div className="flex gap-1">
          <div className="flex w-5 shrink-0 flex-col gap-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <span
                key={label}
                className="h-[11px] text-[9px] leading-[11px] text-ink/35"
              >
                {i % 2 === 1 ? label : ''}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex shrink-0 flex-col gap-1">
              {week.map((cell, di) =>
                cell ? (
                  <button
                    key={cell.day}
                    type="button"
                    title={`${cell.day} · ${cell.count}회`}
                    aria-label={`${cell.day} ${cell.count}회`}
                    disabled={!onSelectDay}
                    className={cn(
                      'h-[11px] w-[11px] rounded-[3px] transition-transform',
                      LEVEL_CLASS[levelOf(cell.count, max)],
                      onSelectDay && 'hover:scale-125',
                    )}
                    onClick={() => onSelectDay?.(cell.day)}
                  />
                ) : (
                  <span key={`${wi}-${di}`} className="h-[11px] w-[11px]" />
                ),
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 pr-1 text-[10px] text-ink/35">
          <span>적음</span>
          {LEVEL_CLASS.map((cls) => (
            <span key={cls} className={cn('h-[9px] w-[9px] rounded-[2px]', cls)} />
          ))}
          <span>많음</span>
        </div>
      </div>
    </div>
  );
}
