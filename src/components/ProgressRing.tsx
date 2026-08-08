import { CheckIcon } from './Icons';

/** Tailwind emerald-500 — the shared "완료" colour. */
const COMPLETE_COLOR = '#10b981';

export function ProgressRing({
  ratio,
  complete,
  size = 36,
  strokeWidth = 3,
  accent,
}: {
  ratio: number; // 0..1
  complete?: boolean;
  size?: number;
  strokeWidth?: number;
  accent?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  // Cover accent tracks progress; completion is always the same green, so a
  // finished album reads the same regardless of its artwork.
  const color = complete
    ? COMPLETE_COLOR
    : (accent ?? 'rgba(29,29,31,0.75)');
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped * 100)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(29,29,31,0.12)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      {complete && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ color }}
        >
          <CheckIcon size={size * 0.45} />
        </span>
      )}
    </div>
  );
}
