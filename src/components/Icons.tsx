interface IconProps {
  size?: number;
  className?: string;
}

function base(size: number | undefined) {
  return { width: size ?? 20, height: size ?? 20 };
}

export function HomeIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

export function SearchIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function UserIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  );
}

export function GearIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
    </svg>
  );
}

export function PlayIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

/** Unchecked affordance for the track status control. */
export function CircleIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8.5" />
    </svg>
  );
}

export function RepeatIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M20.5 6H7a3.5 3.5 0 0 0-3.5 3.5V11" />
      <path d="m7 21.5-3.5-3.5L7 14.5" />
      <path d="M3.5 18H17a3.5 3.5 0 0 0 3.5-3.5V13" />
    </svg>
  );
}

export function CheckIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function SkipIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5.8v12.4a1 1 0 0 0 1.54.84L15 13.5v4.7a1 1 0 0 0 2 0V5.8a1 1 0 0 0-2 0v4.7L6.54 4.96A1 1 0 0 0 5 5.8Z" />
    </svg>
  );
}

export function HeartIcon({ size, className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg
      {...base(size)}
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5S3.5 15.5 3.5 9.6C3.5 6.8 5.7 4.5 8.4 4.5c1.6 0 2.9.8 3.6 2 .7-1.2 2-2 3.6-2 2.7 0 4.9 2.3 4.9 5.1 0 5.9-8.5 10.9-8.5 10.9Z" />
    </svg>
  );
}

export function DotsIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function XIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function RefreshIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11a8 8 0 1 0-2.34 6.34" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function ChevronDownIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronLeftIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function ExternalIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

export function MusicNoteIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 18.5a3 3 0 1 1-2-2.83V5.6a1 1 0 0 1 .76-.97l10-2.5A1 1 0 0 1 19 3.1v11.57a3 3 0 1 1-2-2.83V7.28l-8 2V18.5Z" />
    </svg>
  );
}

export function PencilIcon({ size, className }: IconProps) {
  return (
    <svg {...base(size)} className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3.5 20.5 7 8 19.5 3.5 20.5 4.5 16 17 3.5Z" />
    </svg>
  );
}
