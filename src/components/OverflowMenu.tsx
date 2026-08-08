import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DotsIcon } from './Icons';

export interface OverflowMenuItem {
  label: string;
  onSelect?: () => void;
  href?: string;
}

const MENU_WIDTH = 192;
const VIEWPORT_MARGIN = 8;

interface Position {
  top: number;
  left: number;
  flipped: boolean;
}

/**
 * Row overflow menu. The panel is portalled to <body> because the rows live
 * inside `.glass` cards: those clip with `overflow-hidden`, and their
 * `backdrop-filter` also makes them the containing block for `position:
 * fixed`, so nothing anchored inside the card can escape it.
 */
export function OverflowMenu({
  items,
  label = '메뉴',
  open,
  onOpenChange,
}: {
  items: OverflowMenuItem[];
  label?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const menuHeight = menuRef.current?.offsetHeight ?? items.length * 42 + 8;
      const spaceBelow = window.innerHeight - trigger.bottom;
      const flipped = spaceBelow < menuHeight + VIEWPORT_MARGIN;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, trigger.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN,
      );
      setPosition({
        top: flipped ? trigger.top - menuHeight - 4 : trigger.bottom + 4,
        left,
        flipped,
      });
    };
    place();
    // Re-place after the panel has a real height, then keep it anchored.
    const raf = requestAnimationFrame(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const close = () => onOpenChange(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-6 shrink-0 items-center justify-center text-ink/30 hover:text-ink/60"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <DotsIcon size={16} />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[70]" onClick={close}>
            <div
              ref={menuRef}
              role="menu"
              className="glass-bar fade-in absolute overflow-hidden rounded-2xl py-1 text-sm text-ink"
              style={{
                width: MENU_WIDTH,
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? 'visible' : 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item) =>
                item.href ? (
                  <a
                    key={item.label}
                    role="menuitem"
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full px-4 py-2.5 text-left hover:bg-ink/[0.05]"
                    onClick={close}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    role="menuitem"
                    type="button"
                    className="block w-full px-4 py-2.5 text-left hover:bg-ink/[0.05]"
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {item.label}
                  </button>
                ),
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
