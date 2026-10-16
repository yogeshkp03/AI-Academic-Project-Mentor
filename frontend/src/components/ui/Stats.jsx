import { cn } from '../ui/cn';

/* ==========================================================================
   StatCard — a real metric, not a label with a decorative value.
   =elaborate: icon, value, delta, optional footer note.
   ========================================================================== */
export function StatCard({
  icon: Icon,
  value,
  label,
  hint,
  delta,
  deltaTone = 'neutral',
  tone = 'brand',
  loading = false,
  onClick,
  className,
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    danger: 'bg-danger-50 text-danger-600',
    info: 'bg-info-50 text-info-600',
    ochre: 'bg-ochare-50 text-ochare-600',
  };
  const deltaTones = {
    neutral: 'text-ink-muted',
    up: 'text-success-600',
    down: 'text-danger-600',
    good: 'text-success-600',
    bad: 'text-danger-600',
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3.5 rounded-xl border border-line bg-surface p-4 text-left shadow-1',
        'transition-[box-shadow,transform,border-color] duration-200',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2',
        className,
      )}
    >
      {Icon && (
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-[10px]', tones[tone])}>
          <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] leading-none font-semibold tracking-wide text-ink-muted uppercase">
          {label}
        </p>
        {loading ? (
          <div className="skeleton mt-2 h-7 w-16" />
        ) : (
          <p className="mt-1.5 font-display text-[24px] leading-none font-semibold text-ink tabular">
            {value}
          </p>
        )}
        {delta ? (
          <p className={cn('mt-1.5 text-[12px] font-semibold', deltaTones[deltaTone])}>{delta}</p>
        ) : (
          hint && <p className="mt-1.5 truncate text-[12px] text-ink-muted">{hint}</p>
        )}
      </div>
    </Tag>
  );
}

/* ==========================================================================
   StatusBadge — one place that maps domain statuses to tone + glyph
   ========================================================================== */
const RUN_STATUS = {
  queued: { tone: 'warning', label: 'Queued' },
  running: { tone: 'brand', label: 'Working' },
  completed: { tone: 'success', label: 'Complete' },
  failed: { tone: 'danger', label: 'Failed' },
};

const STEP_STATUS = {
  pending: { tone: 'neutral', label: 'Pending' },
  running: { tone: 'brand', label: 'Running' },
  completed: { tone: 'success', label: 'Done' },
  failed: { tone: 'danger', label: 'Failed' },
};

const PROPOSAL_STATUS = {
  pending: { tone: 'warning', label: 'Awaiting you' },
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'neutral', label: 'Rejected' },
  stale: { tone: 'danger', label: 'Superseded' },
};

const RISK_STATUS = {
  open: { tone: 'danger', label: 'Open' },
  mitigated: { tone: 'success', label: 'Mitigated' },
  accepted: { tone: 'warning', label: 'Accepted' },
};

export function StatusBadge({ status, map = 'run', className, children }) {
  const table = map === 'step' ? STEP_STATUS : map === 'proposal' ? PROPOSAL_STATUS : map === 'risk' ? RISK_STATUS : RUN_STATUS;
  const entry = table[status] || { tone: 'neutral', label: status };
  const toneClass = {
    neutral: 'border-line bg-subtle text-ink-muted',
    brand: 'border-brand-100 bg-brand-50 text-brand-700',
    success: 'border-success-100 bg-success-50 text-success-700',
    warning: 'border-warning-100 bg-warning-50 text-warning-700',
    danger: 'border-danger-100 bg-danger-50 text-danger-700',
    info: 'border-info-100 bg-info-50 text-info-600',
    ochre: 'border-ochare-200/70 bg-ochare-50 text-ochare-600',
  }[entry.tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        toneClass,
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          entry.tone === 'brand' && 'animate-pulse-soft bg-brand-500',
          entry.tone === 'success' && 'bg-success-500',
          entry.tone === 'warning' && 'bg-warning-500',
          entry.tone === 'danger' && 'bg-danger-500',
          entry.tone === 'neutral' && 'bg-ink-faint',
          entry.tone === 'info' && 'bg-info-500',
          entry.tone === 'ochre' && 'bg-ochare-500',
        )}
      />
      {children || entry.label}
    </span>
  );
}
