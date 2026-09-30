import { cn } from '../../lib/cn';

export function ProgressBar({ value = 0, className }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 animate-progress"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}