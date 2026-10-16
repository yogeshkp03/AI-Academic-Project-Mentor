import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { BrandMark } from '../Brand';

/**
 * AuthShell — split-screen entry.
 * Left: the product's promise, told once, in the brand's own voice.
 * Right: the task at hand.
 */
export function AuthShell({
  children,
  eyebrow,
  title,
  subtitle,
  footer,
  links = [],
}) {
  return (
    <div className="relative flex min-h-screen bg-canvas">
      {/* Narrative panel */}
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-line bg-brand-900 p-10 text-ink-inverse lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 size-[30rem] rounded-full bg-brand-700/50 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 bottom-0 size-[26rem] rounded-full bg-ochare-500/20 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />

        <Link to="/" className="relative no-underline">
          <span className="flex items-center gap-3">
            <BrandMark size={36} />
            <span className="font-display text-[17px] font-semibold text-ink-inverse">
              Project&nbsp;Mentor
            </span>
          </span>
        </Link>

        <div className="relative max-w-md">
          <p className="eyebrow text-ochare-300">{eyebrow}</p>
          <h2 className="mt-3 font-display text-[34px] leading-[1.15] font-semibold text-ink-inverse">
            Your project deserves a mentor who never runs out of patience.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-brand-100/80">
            Eight specialists review your idea, then stay with you — through milestones,
            risks, and the weekly check-in your guide will actually read.
          </p>
          <ul className="mt-7 space-y-2.5">
            {[
              'Feasibility, architecture, scope and timeline — reviewed in one pass',
              'Milestones you check off, not a deadline you panic about',
              'A written record your faculty supervisor can evaluate',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[13.5px] text-brand-100/85">
                <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-ochare-400/90 text-brand-900">
                  <Check size={11} strokeWidth={3.2} aria-hidden="true" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <blockquote className="relative max-w-md border-l-2 border-ochare-400/70 pl-4">
          <p className="font-display text-[15px] leading-relaxed text-brand-100/85 italic">
            “I stopped planning in my head and started planning on paper. The blueprint
            gave me something to argue with — which is exactly what a good supervisor does.”
          </p>
          <footer className="mt-2 text-[12px] text-brand-200/70">
            Final-year student, Computer Engineering
          </footer>
        </blockquote>
      </aside>

      {/* Form panel */}
      <main className="flex w-full flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[26rem]">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-muted no-underline transition-colors hover:text-ink"
          >
            ← Back to home
          </Link>

          <div className="animate-rise rounded-2xl border border-line bg-surface p-7 shadow-3 sm:p-8">
            <h1 className="text-[24px] leading-tight font-semibold text-ink">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{subtitle}</p>
            )}
            <div className="mt-7">{children}</div>
          </div>

          {links.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 text-center text-[13px] text-ink-muted">
              {links.map((link) => (
                <p key={link.to}>
                  {link.lead}{' '}
                  <Link
                    to={link.to}
                    className="font-semibold text-brand-700 underline decoration-brand-200 decoration-2 underline-offset-3 transition-colors hover:text-brand-800 hover:decoration-brand-400"
                  >
                    {link.label}
                  </Link>
                </p>
              ))}
            </div>
          )}
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
