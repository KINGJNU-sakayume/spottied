import { cn } from '../utils/cn';

/** Recessed placeholder block with a single quiet pulse. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('glass-inset animate-pulse rounded-[10px]', className)}
      aria-hidden
    />
  );
}

/** Stand-in for the artist page's cover grid while the store loads. */
export function AlbumGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-1.5 h-3 w-3/4 rounded" />
          <Skeleton className="mt-1.5 h-2.5 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
