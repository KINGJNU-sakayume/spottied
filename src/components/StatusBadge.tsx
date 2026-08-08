import type { ArtistDigStatus } from '../types';
import { cn } from '../utils/cn';
import { ARTIST_STATUS_LABEL } from '../utils/derive';

const STYLES: Record<ArtistDigStatus, string> = {
  'not-started': 'bg-ink/[0.07] text-ink/55 ring-ink/[0.06]',
  'in-progress': 'bg-sky-500/15 text-sky-700 ring-sky-500/20',
  completed: 'bg-amber-500/20 text-amber-700 ring-amber-500/25',
};

export function StatusBadge({
  status,
  className,
}: {
  status: ArtistDigStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        STYLES[status],
        className,
      )}
    >
      {ARTIST_STATUS_LABEL[status]}
    </span>
  );
}
