import { Link } from 'react-router-dom';

export function AuthCard({ icon = '🤖', title, subtitle, children, footer }) {
  return (
    <div className="animate-rise rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-card backdrop-blur md:p-10">
      <Link
        to="/"
        className="text-sm font-medium text-slate-500 transition hover:text-brand-600"
      >
        ← Back to Home
      </Link>

      <div className="mx-auto mt-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 text-3xl">
        {icon}
      </div>

      <h1 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>

      <div className="mt-7">{children}</div>
      {footer}
    </div>
  );
}