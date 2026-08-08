import { CheckIcon } from './Icons';

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
  const color = accent ?? 'rgba(255,255,255,0.9)';
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
          stroke="rgba(255,255,255,0.15)"
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
