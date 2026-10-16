import { cn } from '../ui/cn';
import { Spinner } from './Button';

/* ==========================================================================
   Form fields
   ========================================================================== */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-baseline gap-1.5 text-[13px] font-semibold text-ink-soft"
        >
          {label}
          {required && <span className="text-danger-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-danger-600">{error}</p>
      ) : (
        hint && <p className="text-[12px] text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

const CONTROL = cn(
  'w-full rounded-[10px] border border-line-strong bg-inset px-3.5 text-[14px] text-ink',
  'placeholder:text-ink-faint',
  'transition-[border-color,box-shadow,background-color] duration-150',
  'hover:border-ink-faint',
  'focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-3 focus:ring-brand-500/15',
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted',
);

export function Input({ className, icon: Icon, invalid, ...props }) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
          aria-hidden="true"
        />
        <input
          className={cn(
            CONTROL,
            'h-11 pl-9',
            invalid && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15',
            className,
          )}
          {...props}
        />
      </div>
    );
  }
  return (
    <input
      className={cn(CONTROL, 'h-11', invalid && 'border-danger-500 focus:ring-danger-500/15', className)}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }) {
  return (
    <textarea
      className={cn(
        CONTROL,
        'min-h-24 py-2.5 leading-relaxed',
        invalid && 'border-danger-500 focus:ring-danger-500/15',
        className,
      )}
      {...props}
    />
  );
}

const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className, invalid, children, ...props }) {
  return (
    <select
      className={cn(
        CONTROL,
        'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10',
        invalid && 'border-danger-500',
        className,
      )}
      style={{ backgroundImage: SELECT_ARROW }}
      {...props}
    >
      {children}
    </select>
  );
}

/** Labelled checkbox with a real check glyph. */
export function Checkbox({ label, className, ...props }) {
  return (
    <label
      className={cn(
        'group inline-flex cursor-pointer items-start gap-2.5 text-[14px] text-ink-soft select-none',
        className,
      )}
    >
      <span className="relative mt-px grid size-4.5 shrink-0 place-items-center">
        <input
          type="checkbox"
          className={cn(
            'peer size-4.5 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-inset',
            'transition-colors duration-150',
            'checked:border-brand-600 checked:bg-brand-600',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
          )}
          {...props}
        />
        <svg
          className="pointer-events-none absolute hidden text-white peer-checked:block"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      {label}
    </label>
  );
}

/** Range input styled as a warm slider (confidence ratings etc.) */
export function Slider({ className, ...props }) {
  return (
    <input
      type="range"
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-subtle-strong',
        '[&::-webkit-slider-thumb]:size-4.5 [&::-webkit-slider-thumb]:appearance-none',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-600',
        '[&::-webkit-slider-thumb]:shadow-brand [&::-webkit-slider-thumb]:transition-transform',
        '[&::-webkit-slider-thumb]:hover:scale-115',
        '[&::-moz-range-thumb]:size-4.5 [&::-moz-range-thumb]:appearance-none',
        '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
        '[&::-moz-range-thumb]:bg-brand-600',
        className,
      )}
      {...props}
    />
  );
}

/* ==========================================================================
   Message — inline banners
   ========================================================================== */
const MESSAGE_TONES = {
  error: 'bg-danger-50 border-danger-100 text-danger-700',
  success: 'bg-success-50 border-success-100 text-success-700',
  warning: 'bg-warning-50 border-warning-100 text-warning-700',
  info: 'bg-info-50 border-info-100 text-info-600',
  brand: 'bg-brand-50 border-brand-100 text-brand-700',
  ochre: 'bg-ochre-50 border-ochre-200/70 text-ochare-600',
};

export function Message({ type = 'error', className, children, ...props }) {
  if (!children) return null;
  return (
    <div
      className={cn(
        'animate-pop rounded-xl border px-4 py-3 text-[13px] leading-relaxed font-medium',
        MESSAGE_TONES[type],
        className,
      )}
      role={type === 'error' ? 'alert' : 'status'}
      {...props}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   EmptyState — four moods
   ========================================================================== */
export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  message,
  action,
  mood = 'first-run',
  className,
}) {
  const moods = {
    'first-run': 'border-dashed border-line-strong bg-subtle/50',
    filtered: 'border-dashed border-line bg-transparent',
    error: 'border-danger-100 bg-danger-50',
    locked: 'border-line-strong bg-gradient-to-br from-brand-50 to-ochre-50',
  };
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center',
        moods[mood],
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl border border-line-strong bg-surface text-ink-faint shadow-1">
          <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {message && (
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-muted">{message}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ==========================================================================
   Spinner overlay for card-level loading
   ========================================================================== */
export function LoadingCover({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <Spinner size={22} className="text-brand-600" />
      {label && <p className="animate-pulse-soft text-[13px] text-ink-muted">{label}</p>}
    </div>
  );
}
