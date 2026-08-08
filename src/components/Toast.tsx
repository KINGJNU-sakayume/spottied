import { useUiStore } from '../store/uiStore';
import { cn } from '../utils/cn';

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-40 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-28"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'glass-bar toast-in flex max-w-full items-center rounded-full text-ink',
            t.grand
              ? 'px-6 py-3 text-base font-bold'
              : 'px-4 py-2 text-sm font-semibold',
            // Only action toasts capture taps; plain ones stay transparent to
            // whatever sits underneath them.
            t.action && 'pointer-events-auto gap-3 pr-1.5',
          )}
        >
          <span className="min-w-0 truncate">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="-my-1.5 shrink-0 rounded-full bg-ink/[0.08] px-3.5 py-2.5 text-xs font-bold text-ink transition-colors hover:bg-ink/[0.16] active:scale-95"
              onClick={() => {
                t.action?.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
