import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CalendarRange,
  Compass,
  GaugeCircle,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { BrandMark } from '../components/Brand';
import { Button, ButtonLink } from '../components/ui';

/* ==========================================================================
   Landing — tells the story: idea → eight specialists → tracked, mentored work
   ========================================================================== */

const AGENT_PIPELINE = [
  { key: 'feasibility', label: 'Feasibility', tint: 'brand' },
  { key: 'architect', label: 'Architecture', tint: 'brand' },
  { key: 'scope', label: 'MVP scope', tint: 'ochre' },
  { key: 'timeline', label: 'Timeline', tint: 'ochre' },
  { key: 'ui_ux', label: 'UI / UX', tint: 'ochare' },
  { key: 'planning', label: 'Execution plan', tint: 'brand' },
  { key: 'professor', label: 'QA review', tint: 'brand' },
  { key: 'resource', label: 'Resources', tint: 'ochare' },
];

const TINTS = {
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  ochre: 'border-ochare-200/70 bg-ochare-50 text-ochare-600',
  ochare: 'border-line bg-subtle text-ink-soft',
};

function Navbar() {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <BrandMark size={30} />
          <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
            Project&nbsp;Mentor
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <a
            href="#how-it-works"
            className="hidden rounded-[10px] px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft no-underline transition-colors hover:bg-subtle hover:text-ink sm:inline-block"
          >
            How it works
          </a>
          <a
            href="#capabilities"
            className="hidden rounded-[10px] px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft no-underline transition-colors hover:bg-subtle hover:text-ink sm:inline-block"
          >
            Capabilities
          </a>
          <Button variant="subtle" size="sm" onClick={() => navigate('/login')}>
            Sign in
          </Button>
          <Button size="sm" iconRight={ArrowRight} onClick={() => navigate('/register')}>
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden px-5 pt-16 pb-20 sm:px-8 lg:pt-24">
      {/* Warm glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/4 size-[34rem] rounded-full bg-brand-200/35 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 -right-32 size-[26rem] rounded-full bg-ochare-200/40 blur-[110px]"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="eyebrow eyebrow-accent animate-fade-up">
          AI-guided academic project mentorship
        </p>
        <h1 className="animate-rise mt-4 font-display text-[clamp(2.4rem,6vw,3.75rem)] leading-[1.04] font-semibold text-ink">
          Stop guessing.
          <br />
          <span className="text-brand-700 italic">Start building with a plan.</span>
        </h1>
        <p className="animate-fade-up mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          Write one paragraph about your project idea. A team of eight AI specialists
          turns it into a feasibility report, an architecture, and a week-by-week
          blueprint — then stays with you until you ship.
        </p>
        <div className="animate-rise mt-9 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Button size="lg" iconRight={ArrowRight} onClick={() => navigate('/register')}>
            Plan my project free
          </Button>
          <ButtonLink size="lg" variant="secondary" to="/login">
            I already have an account
          </ButtonLink>
        </div>
        <p className="mt-4 text-[12.5px] text-ink-muted">
          Built for final-year capstones · No credit card · Your supervisor can review every step
        </p>
      </div>

      {/* The pipeline, drawn */}
      <div className="relative mx-auto mt-16 max-w-4xl">
        <PipelineDiagram />
      </div>
    </section>
  );
}

function PipelineDiagram() {
  return (
    <div className="relative rounded-2xl border border-line bg-surface p-6 shadow-3 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">One analysis, eight perspectives</p>
          <p className="mt-1 font-display text-[17px] font-semibold text-ink">
            The specialist team behind every blueprint
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-100 bg-success-50 px-3 py-1 text-[12px] font-semibold text-success-700">
          <GaugeCircle size={13} aria-hidden="true" />
          Runs in about two minutes
        </span>
      </div>

      <ol className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AGENT_PIPELINE.map((agent, i) => (
          <li
            key={agent.key}
            className="animate-pop flex items-center gap-2.5 rounded-xl border p-3"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span
              className={`grid size-8 shrink-0 place-items-center rounded-[9px] border text-[12px] font-bold ${TINTS[agent.tint]}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">
                {agent.label}
              </span>
              <span className="text-[11px] text-ink-muted">specialist</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
        <div className="flex flex-1 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
            <Compass size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">In: one paragraph</p>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Your idea, your tech stack, your duration.
            </p>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="hidden w-px self-stretch bg-line sm:block"
        />
        <div className="flex flex-1 items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-ochare-50 text-ochare-600">
            <BookOpenCheck size={17} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">Out: a blueprint you can defend</p>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Report, milestones, and a record for your guide.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: '01',
    title: 'Describe your project',
    text: 'A few lines is enough — what you want to build, and roughly how long you have.',
    icon: Sparkles,
  },
  {
    n: '02',
    title: 'The team reviews it',
    text: 'Feasibility, architecture, scope, timeline, UI/UX, planning, QA and resources — each writes its own verdict.',
    icon: BrainCircuit,
  },
  {
    n: '03',
    title: 'Work the plan, with backup',
    text: 'Check off milestones, log weekly check-ins, and ask any specialist why they decided what they decided.',
    icon: CalendarRange,
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="eyebrow eyebrow-accent">How it works</p>
          <h2 className="mt-3 font-display text-[clamp(1.75rem,3.4vw,2.4rem)] leading-[1.12] font-semibold text-ink">
            Three steps from a vague idea to a plan you can defend in a viva.
          </h2>
        </div>

        <div className="relative mt-12">
          {/* Connecting rule behind the steps */}
          <div
            aria-hidden="true"
            className="absolute top-6 right-8 left-8 hidden border-t border-dashed border-line-strong lg:block"
          />
          <ol className="grid gap-6 lg:grid-cols-3">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.n} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="relative z-10 grid size-12 place-items-center rounded-full border border-line-strong bg-surface font-display text-[15px] font-semibold text-brand-700 shadow-1">
                      {step.n}
                    </span>
                    <span className="grid size-9 place-items-center rounded-[10px] bg-subtle text-ink-muted">
                      <Icon size={17} strokeWidth={1.85} aria-hidden="true" />
                    </span>
                  </div>
                  <h3 className="mt-5 text-[17px] font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
                    {step.text}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Eight specialists, one report',
    text: 'Each agent writes its own section, and you can question any of them individually in the AI Workspace.',
  },
  {
    icon: CalendarRange,
    title: 'Milestones, not a deadline',
    text: 'Your plan becomes checkable milestones. Tick them off and the mentor notices what that means for the rest.',
  },
  {
    icon: MessageSquareQuote,
    title: 'A mentor that read your work',
    text: 'Weekly check-ins are reviewed against your own saved plan — advice, not generic encouragement.',
  },
  {
    icon: TriangleAlert,
    title: 'A risk register that earns its keep',
    text: 'The risk agent writes down what could sink delivery, with likelihood, impact and mitigation — then you mark it handled.',
  },
  {
    icon: ShieldCheck,
    title: 'Built for faculty review',
    text: 'Supervisors can read your blueprint, milestone progress and evaluations in a dedicated portal.',
  },
  {
    icon: GaugeCircle,
    title: 'Skill checks that match your stack',
    text: 'Quizzes are drawn from the skills you declared, so you find the gaps before your code does.',
  },
];

function Features() {
  return (
    <section id="capabilities" className="scroll-mt-20 px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="eyebrow eyebrow-accent">Capabilities</p>
            <h2 className="mt-3 font-display text-[clamp(1.75rem,3.4vw,2.4rem)] leading-[1.12] font-semibold text-ink">
              Everything a capstone needs, in one place.
            </h2>
          </div>
          <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
            Plan, track, ask, record — without maintaining a spreadsheet nobody opens again.
          </p>
        </div>

        <div className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article
                key={feature.title}
                className="group rounded-2xl border border-line bg-surface p-5 shadow-1 transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-3"
              >
                <span className="grid size-10 place-items-center rounded-[10px] bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-100">
                  <Icon size={18} strokeWidth={1.85} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const navigate = useNavigate();
  return (
    <section className="px-5 pb-20 sm:px-8">
      <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-brand-900 px-7 py-14 text-center text-ink-inverse sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/3 size-[26rem] rounded-full bg-brand-700/50 blur-[100px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-28 size-[22rem] rounded-full bg-ochare-500/25 blur-[100px]"
        />
        <div className="relative">
          <p className="eyebrow text-ochare-300">Ready when you are</p>
          <h2 className="mt-3 font-display text-[clamp(1.6rem,3.2vw,2.25rem)] leading-[1.14] font-semibold text-ink-inverse">
            Your project has a deadline. Give it a plan too.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[14.5px] leading-relaxed text-brand-100/80">
            Sign up, describe your idea, and have a full blueprint in your hands before
            your next meeting with your guide.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button
              size="lg"
              variant="accent"
              iconRight={ArrowRight}
              onClick={() => navigate('/register')}
            >
              Start my blueprint
            </Button>
            <ButtonLink
              size="lg"
              to="/faculty/register"
              className="border-brand-700 bg-transparent text-ink-inverse hover:bg-brand-800"
            >
              I'm a faculty supervisor
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-5 py-9 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <span className="font-display text-[13.5px] font-semibold text-ink">
            Project&nbsp;Mentor
          </span>
        </span>
        <p className="text-[12.5px] text-ink-muted">
          AI Academic Project Mentor
        </p>
        <div className="flex items-center gap-4 text-[12.5px] font-semibold">
          <Link to="/login" className="text-ink-soft no-underline hover:text-brand-700">
            Sign in
          </Link>
          <Link to="/faculty/login" className="text-ink-soft no-underline hover:text-brand-700">
            Faculty
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <FinalCta />
      <Footer />
    </div>
  );
}
