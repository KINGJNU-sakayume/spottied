import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { cn } from '../utils/cn';

const FILLED_PATH =
  'M12 2.6l2.86 5.8 6.4.93-4.63 4.51 1.1 6.37L12 17.2l-5.72 3.01 1.09-6.37L2.74 9.33l6.4-.93L12 2.6Z';

function Star({ size, outline = false }: { size: number; outline?: boolean }) {
  // An outline star reads as "not rated yet"; a filled grey one is nearly
  // indistinguishable from a half star at these sizes.
  return outline ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d={FILLED_PATH} />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d={FILLED_PATH} />
    </svg>
  );
}

const clampRating = (v: number) => Math.min(5, Math.max(0.5, v));

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
  const editable = !readOnly && onChange != null;

  const compute = (clientX: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0.5;
    const ratio = (clientX - rect.left) / rect.width;
    return clampRating(Math.ceil(ratio * 10) / 2);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!editable) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragValue(compute(e.clientX));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setDragValue(compute(e.clientX));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !editable) return;
    draggingRef.current = false;
    const v = compute(e.clientX);
    setDragValue(null);
    onChange?.(v === value ? undefined : v);
  };

  const onPointerCancel = () => {
    // Without this a cancelled drag leaves draggingRef stuck true and the
    // preview value frozen on screen.
    draggingRef.current = false;
    setDragValue(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    const current = value ?? 0;
    let next: number | undefined;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = clampRating(current - 0.5);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = clampRating(current + 0.5);
        break;
      case 'Home':
        next = 0.5;
        break;
      case 'End':
        next = 5;
        break;
      case 'Delete':
      case 'Backspace':
        next = undefined;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange?.(next);
  };

  const shown = dragValue ?? value ?? 0;
  const width = size * 5 + 4 * 2; // 5 stars + gaps
  const unrated = shown === 0;

  return (
    <div
      ref={ref}
      className={cn(
        'relative inline-block select-none rounded-md',
        // pan-y rather than none: only the horizontal drag is ours, so the
        // page still scrolls vertically from on top of the stars.
        editable &&
          'cursor-pointer touch-pan-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/25',
        className,
      )}
      style={{ width, height: size }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      tabIndex={editable ? 0 : undefined}
      role={readOnly ? 'img' : 'slider'}
      aria-label={shown > 0 ? `별점 ${shown}점` : '별점 없음'}
      aria-valuenow={shown}
      aria-valuemin={0}
      aria-valuemax={5}
    >
      <div className={cn('flex gap-[2px]', unrated ? 'text-ink/20' : 'text-ink/15')}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={size} outline={unrated} />
        ))}
      </div>
      <div
        className="absolute inset-y-0 left-0 overflow-hidden text-amber-500 transition-[width] duration-150"
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
