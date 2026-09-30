import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';

export function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden px-6 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/4 size-80 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-1/4 bottom-1/4 size-96 translate-x-1/2 rounded-full bg-violet-200/40 blur-3xl"
      />

      <div className="relative z-10 max-w-3xl animate-hero">
        <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-bold text-brand-700">
          AI-powered academic mentorship
        </span>
        <h1 className="mt-6 text-4xl leading-tight font-extrabold tracking-tight text-slate-900 md:text-6xl md:leading-[1.05]">
          Manage Your Academic Projects <span className="text-brand-600">Smarter with AI</span> 🚀
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
          Plan your project, track tasks, monitor progress, and get AI-powered mentorship
          assistance — from feasibility to a week-by-week blueprint.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" onClick={() => navigate('/register')}>
            Get Started →
          </Button>
          <Button size="lg" variant="secondary" onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </div>
    </section>
  );
}