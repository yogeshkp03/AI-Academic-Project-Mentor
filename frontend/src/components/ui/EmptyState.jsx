import { cn } from '../../lib/cn';

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-10 text-center')}>
      <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
        {icon}
      </div>
      {title && <h3 className="mt-1 text-sm font-semibold text-slate-800">{title}</h3>}
      {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}