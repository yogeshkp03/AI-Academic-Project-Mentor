import { cn } from '../../lib/cn';

export function Card({ title, actions, className, children, hover = false }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-6 shadow-card animate-fade-up',
        hover && 'transition-shadow duration-300 hover:shadow-card-hover',
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}