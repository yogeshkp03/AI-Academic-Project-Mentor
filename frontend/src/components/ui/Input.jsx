import { cn } from '../../lib/cn';

export function Field({ label, hint, className, children }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const controlClasses =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100';

export function Input({ className, ...props }) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(controlClasses, 'resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(controlClasses, 'cursor-pointer', className)} {...props}>
      {children}
    </select>
  );
}