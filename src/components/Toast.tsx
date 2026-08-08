import { useUiStore } from '../store/uiStore';
import { cn } from '../utils/cn';

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-40 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-28">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'glass-bar toast-in max-w-full truncate rounded-full text-ink',
            t.grand
              ? 'px-6 py-3 text-base font-bold'
              : 'px-4 py-2 text-sm font-semibold',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
