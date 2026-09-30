import { cn } from '../../lib/cn';
import { statusLabel } from '../../lib/format';

const styles = {
  queued: 'bg-slate-100 text-slate-600',
  running: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

const dots = {
  queued: 'bg-slate-400',
  running: 'bg-sky-500 animate-pulse',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
};

export function StatusBadge({ status, className }) {
  const key = status || 'queued';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        styles[key] || styles.queued,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', dots[key] || dots.queued)} />
      {statusLabel(key)}
    </span>
  );
}