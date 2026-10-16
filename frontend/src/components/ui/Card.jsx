import { cn } from '../ui/cn';

/* ==========================================================================
   Card + subcomponents — one surface, many uses
   ========================================================================== */
export function Card({
  variant = 'elevated',
  className,
  children,
  hover = false,
  ...props
}) {
  const variants = {
    elevated: 'bg-surface border border-line shadow-2',
    outlined: 'bg-surface border border-line-strong shadow-1',
    inset: 'bg-subtle border border-line/70 shadow-none',
    accent: 'bg-brand-50/70 border border-brand-100 shadow-1',
    ochre: 'bg-ochre-50/70 border border-ochre-200/70 shadow-1',
  };
  return (
    <section
      className={cn(
        'rounded-2xl',
        variants[variant],
        hover && 'transition-shadow duration-300 hover:shadow-3',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  eyebrow,
  actions,
  className,
  children,
}) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
            <Icon size={17} strokeWidth={2} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-0.5">{eyebrow}</p>}
          {title && <h2 className="text-[15px] leading-snug font-semibold text-ink">{title}</h2>}
          {subtitle && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return (
    <footer
      className={cn(
        'flex items-center justify-between gap-3 border-t border-line px-5 py-3',
        className,
      )}
    >
      {children}
    </footer>
  );
}

/* ==========================================================================
   Section — page-level rhythm. Title + optional description + content.
   ========================================================================== */
export function Section({ title, description, actions, className, children }) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-[17px] leading-tight font-semibold text-ink">{title}</h2>
            )}
            {description && (
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ==========================================================================
   PageHeader — the top of every authenticated page
   ========================================================================== */
export function PageHeader({ title, subtitle, eyebrow, actions, className, children }) {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="text-[26px] leading-[1.15] font-semibold text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
      <div className="rule-fade" />
    </header>
  );
}

/* ==========================================================================
   Badge — semantic status pills
   ========================================================================== */
const BADGE_TONES = {
  neutral: 'bg-subtle text-ink-soft border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-100',
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  danger: 'bg-danger-50 text-danger-700 border-danger-100',
  info: 'bg-info-50 text-info-600 border-info-100',
  ochre: 'bg-ochre-50 text-ochare-600 border-ochre-200/70',
};

export function Badge({ tone = 'neutral', dot = false, icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {Icon && <Icon size={12} strokeWidth={2.5} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ==========================================================================
   Avatar — deterministic initials colour from a name
   ========================================================================== */
const AVATAR_TONES = [
  'bg-brand-100 text-brand-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
  'bg-danger-100 text-danger-700',
  'bg-info-100 text-info-600',
  'bg-ochare-100 text-ochare-600',
];

export function Avatar({ name = '', size = 36, className }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold',
        tone,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

/* ==========================================================================
   Skeletons
   ========================================================================== */
export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

export function SkeletonCard({ lines = 3, className }) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-9 rounded-[10px]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/5' : 'w-full')} />
        ))}
      </div>
    </Card>
  );
}

export function SkeletonList({ rows = 4, className }) {
  return (
    <div className={cn('divide-y divide-line', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <Skeleton className="size-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   ProgressBar — smooth, striped while running, and a stepped variant
   ========================================================================== */
export function ProgressBar({ value = 0, indeterminate = false, className }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-subtle-strong',
        className,
      )}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-brand-400 to-brand-600" />
      ) : (
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-[width] duration-700 ease-out"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}

/** Stepped rail for the 8 analysis stages. */
export function StepRail({ steps, className }) {
  const done = steps.filter((s) => s.status === 'completed').length;
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((s, i) => (
        <span
          key={s.key || i}
          title={`${s.label}: ${s.status}`}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors duration-500',
            s.status === 'completed' && 'bg-success-500',
            s.status === 'running' && 'animate-pulse-soft bg-brand-500',
            s.status === 'failed' && 'bg-danger-500',
            (s.status === 'pending' || !s.status) && 'bg-subtle-strong',
          )}
        />
      ))}
      <span className="ml-2 text-[12px] font-semibold text-ink-muted tabular">
        {done}/{steps.length}
      </span>
    </div>
  );
}
