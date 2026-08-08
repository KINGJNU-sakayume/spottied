import type { ArtistDigStatus } from '../types';
import { cn } from '../utils/cn';
import { ARTIST_STATUS_LABEL } from '../utils/derive';

const STYLES: Record<ArtistDigStatus, string> = {
  'not-started': 'bg-white/10 text-white/60',
  'in-progress': 'bg-sky-400/20 text-sky-200',
  completed: 'bg-amber-400/20 text-amber-200',
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
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STYLES[status],
        className,
      )}
    >
      {ARTIST_STATUS_LABEL[status]}
    </span>
  );
}
