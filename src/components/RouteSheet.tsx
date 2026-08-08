import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Mobile bottom-sheet wrapper for the /album/:id route. It is a real route:
 * browser back / iOS edge-swipe-back closes it, reload restores it.
 */
export function RouteSheet({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="fade-in absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="sheet-in glass-deep absolute inset-x-0 bottom-0 top-10 overflow-y-auto rounded-t-3xl">
        <div className="sticky top-0 z-10 flex justify-center pb-1 pt-2">
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        {children}
      </div>
    </div>
  );
}
