import { cn } from '../../lib/cn';

const iconColors = {
  blue: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  purple: 'bg-violet-50 text-violet-600',
  orange: 'bg-orange-50 text-orange-600',
  slate: 'bg-slate-100 text-slate-600',
};

export function StatCard({ icon = '📊', color = 'blue', label, value, sub }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition-transform duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-xl',
          iconColors[color] || iconColors.blue,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <h2 className="truncate text-2xl font-extrabold text-slate-900">{value}</h2>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}