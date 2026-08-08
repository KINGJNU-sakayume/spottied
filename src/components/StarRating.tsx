import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { cn } from '../utils/cn';

function Star({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.6l2.86 5.8 6.4.93-4.63 4.51 1.1 6.37L12 17.2l-5.72 3.01 1.09-6.37L2.74 9.33l6.4-.93L12 2.6Z" />
    </svg>
  );
}

/**
 * Letterboxd-style half-star rating (0.5–5.0), tap/drag to set,
 * tap the same value again to clear.
 */
export function StarRating({
  value,
  onChange,
  size = 16,
  readOnly = false,
  className,
}: {
  value?: number;
  onChange?: (value: number | undefined) => void;
  size?: number;
  readOnly?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const compute = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0.5;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(5, Math.max(0.5, Math.ceil(ratio * 10) / 2));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (readOnly || !onChange) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragValue(compute(e.clientX));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setDragValue(compute(e.clientX));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || readOnly || !onChange) return;
    draggingRef.current = false;
    const v = compute(e.clientX);
    setDragValue(null);
    onChange(v === value ? undefined : v);
  };

  const shown = dragValue ?? value ?? 0;
  const width = size * 5 + 4 * 2; // 5 stars + gaps

  return (
    <div
      ref={ref}
      className={cn(
        'relative inline-block select-none',
        !readOnly && onChange && 'cursor-pointer touch-none',
        className,
      )}
      style={{ width, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role={readOnly ? 'img' : 'slider'}
      aria-label={shown > 0 ? `별점 ${shown}점` : '별점 없음'}
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={5}
    >
      <div className="flex gap-[2px] text-white/20">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} />
        ))}
      </div>
      <div
        className="absolute inset-y-0 left-0 overflow-hidden text-amber-300 transition-[width] duration-150"
        style={{ width: `${(shown / 5) * 100}%` }}
      >
        <div className="flex gap-[2px]" style={{ width }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} size={size} />
          ))}
        </div>
      </div>
    </div>
  );
}
