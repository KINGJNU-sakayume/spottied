import { useUiStore } from '../store/uiStore';
import { cn } from '../utils/cn';

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-36 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-24">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'glass toast-in max-w-full truncate rounded-full text-white',
            t.grand
              ? 'px-6 py-3 text-base font-semibold'
              : 'px-4 py-2 text-sm font-medium',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
