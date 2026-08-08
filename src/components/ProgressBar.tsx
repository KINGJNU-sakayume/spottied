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
      className={cn('h-1 w-full overflow-hidden rounded-full bg-white/15', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: accent ?? 'rgba(255,255,255,0.9)' }}
      />
    </div>
  );
}
