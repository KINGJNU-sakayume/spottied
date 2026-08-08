import { cn } from '../utils/cn';

/** Thin seek-bar-like progress bar with an animated fill. */
export function ProgressBar({
  value,
  accent,
  className,
}: {
  value: number; // 0..1
  accent?: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-ink/10 shadow-[inset_0_1px_2px_rgba(16,18,27,0.08)]',
        className,
      )}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: accent ?? 'rgba(29,29,31,0.75)' }}
      />
    </div>
  );
}
