import { cn } from '../../lib/cn';

export function Message({ type, children, className, onDismiss }) {
  if (!children) return null;
  const styles = {
    error: 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium',
        styles[type] || styles.info,
        className,
      )}
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="cursor-pointer text-current opacity-60 transition hover:opacity-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}