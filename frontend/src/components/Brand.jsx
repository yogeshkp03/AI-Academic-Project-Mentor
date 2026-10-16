import { GraduationCap } from 'lucide-react';

/**
 * Brand mark for the Editorial Mentor identity.
 * A graduation cap whose tassel forms an upward arc — mentorship that lifts.
 */
export function BrandMark({ className = '', size = 32, animated = false }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="grid place-items-center rounded-[30%] bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand"
        style={{ width: size, height: size }}
      >
        <GraduationCap
          size={Math.round(size * 0.56)}
          strokeWidth={2}
          className={animated ? 'animate-float' : ''}
          aria-hidden="true"
        />
      </span>
    </span>
  );
}

/** Wordmark: serif product name + role descriptor. */
export function BrandLockup({ compact = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={compact ? 28 : 32} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-semibold tracking-tight text-brand-800">
            Project Mentor
          </span>
          <span className="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-ink-faint uppercase">
            AI Academic Office
          </span>
        </span>
      )}
    </span>
  );
}
