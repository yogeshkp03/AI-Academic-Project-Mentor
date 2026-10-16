import { BrainCircuit, Braces, Building2, CalendarRange, Compass, FileSearch, GraduationCap, Layers, MessageSquareQuote, ScrollText, Sparkles } from 'lucide-react';
import { AgentProgressList } from './AgentProgressList';
import { MarkdownContent } from './MarkdownContent';
import { Badge, Button, StatusBadge } from '../ui';
import { cn } from '../../lib/cn';
import { AGENT_STEP_LABELS } from '../../lib/agentRuns';

const AGENT_META = {
  feasibility: { icon: FileSearch, blurb: 'Can this be built, in your timeframe?' },
  architect: { icon: Building2, blurb: 'Stack, database and system shape' },
  scope: { icon: Layers, blurb: 'What is in the MVP, and what is not' },
  timeline: { icon: CalendarRange, blurb: 'Week-by-week milestones' },
  ui_ux: { icon: Braces, blurb: 'The screens you actually need' },
  planning: { icon: Compass, blurb: 'Execution order and sequences' },
  professor: { icon: GraduationCap, blurb: 'How it will be assessed' },
  resource: { icon: ScrollText, blurb: 'Where to learn each piece' },
};

/** Agent tabs, in pipeline order, plus the mentor. */
const AGENT_SECTIONS = [
  { key: 'mentor', label: 'AI Mentor', icon: Sparkles },
  ...AGENT_STEP_LABELS.map((step) => ({
    key: step.key,
    label: step.label,
    icon: AGENT_META[step.key]?.icon || Sparkles,
  })),
];

function reportSection(report, expectedHeading) {
  if (!report || !expectedHeading || typeof expectedHeading !== 'string') {
    return '';
  }

  const escapedHeading = expectedHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = report.match(
    new RegExp(`(?:^|\\n)##\\s+${escapedHeading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i'),
  );
  return match?.[1]?.trim() || '';
}

const LEGACY_REPORT_HEADINGS = {
  mentor: 'AI Mentor',
  feasibility: 'Feasibility',
  architect: 'Architecture',
  scope: 'MVP scope',
  timeline: 'Timeline',
  resource: 'Learning resources',
  ui_ux: 'UI/UX',
  planning: 'Execution plan',
  professor: 'QA review',
};

function AnalysisStatus({ run }) {
  if (!run) return null;
  const allStepsCompleted =
    run.steps?.length === AGENT_STEP_LABELS.length &&
    run.steps.every((step) => step.status === 'completed');

  if (run.status === 'failed' && allStepsCompleted) {
    return (
      <div className="rounded-xl border border-warning-100 bg-warning-50 px-4 py-3">
        <p className="text-[13px] font-semibold text-warning-700">Report finalisation failed</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-warning-700">
          Every specialist task finished, but the combined report could not be assembled. All
          individual outputs are saved and readable below.
        </p>
      </div>
    );
  }

  if (run.status === 'queued' || run.status === 'running') {
    const currentStep = run.steps?.find((step) => step.status === 'running');
    const meta = currentStep ? AGENT_META[currentStep.step_key] : null;
    return (
      <div className="rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
        <p className="text-[13px] font-semibold text-brand-800">
          {run.status === 'queued'
            ? 'Analysis queued'
            : currentStep
              ? `${AGENT_STEP_LABELS.find((s) => s.key === currentStep.step_key)?.label || 'A specialist'} is working on it`
              : 'The team is working'}
        </p>
        {meta && run.status === 'running' && (
          <p className="mt-0.5 text-[12.5px] text-brand-700/80">{meta.blurb}…</p>
        )}
        <div className="mt-2.5">
          <AgentProgressList steps={run.steps} compact />
        </div>
      </div>
    );
  }

  if (run.status === 'failed') {
    return (
      <div className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-3">
        <p className="text-[13px] font-semibold text-danger-700">Analysis did not finish</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-danger-700">
          Some specialist work is still available. Read the agent tabs, or run a fresh analysis
          from the panel on the left.
        </p>
      </div>
    );
  }

  return null;
}

function AgentReport({ run, section }) {
  const step = run?.steps?.find((item) => item.step_key === section.key);
  const output =
    step?.output || reportSection(run?.output || '', LEGACY_REPORT_HEADINGS[section.key]);

  if (output) {
    return (
      <article className="paper-sheet rounded-2xl border border-line px-6 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[10px] bg-brand-50 text-brand-600">
              <section.icon size={17} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow">Specialist report</p>
              <h2 className="mt-0.5 text-[16px] font-semibold text-ink">{section.label}</h2>
            </div>
          </div>
          <StatusBadge
            status={step?.status === 'completed' ? 'completed' : 'pending'}
            map="step"
          />
        </div>
        <MarkdownContent content={output} />
      </article>
    );
  }

  const hasOlderReport = Boolean(run?.output);
  const isLegacyCompletedRun = step?.status === 'completed' && run?.status === 'failed';
  const message = isLegacyCompletedRun
    ? 'This older run saved one combined report instead of individual outputs, and that section cannot be recovered. A new analysis saves each specialist separately.'
    : hasOlderReport
      ? 'This specialist section was not present in the saved report.'
      : step?.status === 'running'
        ? 'This specialist is still working. Its report appears here the moment it is saved.'
        : step?.status === 'failed'
          ? 'This specialist could not produce output for this run.'
          : !run
            ? 'Run an analysis from the Projects page. Reports appear here automatically.'
            : 'No saved output is available for this agent in the selected run.';

  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-subtle/50 px-6 py-12 text-center">
      <span className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl border border-line-strong bg-surface text-ink-faint">
        <section.icon size={19} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <h2 className="text-[15px] font-semibold text-ink">{section.label} report unavailable</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-ink-muted">{message}</p>
    </div>
  );
}

function MentorConversation({
  messages,
  hasConversation,
  conversationLabel,
  onNewChat,
}) {
  if (!hasConversation) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-subtle/50 px-6 py-12 text-center">
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-brand-600 font-display text-[16px] font-semibold text-white shadow-brand">
          M
        </span>
        <h2 className="font-display text-[18px] font-semibold text-ink">Ask your AI Mentor</h2>
        <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
          The mentor reads your latest saved specialist reports before answering — so it argues
          about <em>your</em> plan, not a generic one.
        </p>
        <Button className="mt-5" icon={MessageSquareQuote} onClick={onNewChat}>
          Start an AI Mentor chat
        </Button>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-6 py-10 text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl border border-line-strong bg-surface text-brand-600 shadow-1">
          <MessageSquareQuote size={19} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h2 className="text-[15px] font-semibold text-ink">
          Your {conversationLabel} chat is ready
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
          Ask about scope, timing, a specialist's reasoning — or paste something you are stuck
          on. Below is the composer.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="AI Mentor conversation" className="flex flex-col gap-4">
      {messages.map((item) => {
        const isUser = item.role === 'user';
        return (
          <article
            key={item.id}
            className={cn(
              'flex max-w-[92%] gap-2.5 sm:max-w-[84%]',
              isUser && 'self-end flex-row-reverse',
            )}
          >
            <span
              className={cn(
                'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full font-display text-[11px] font-semibold',
                isUser ? 'bg-subtle-strong text-ink-soft' : 'bg-brand-600 text-white',
              )}
            >
              {isUser ? 'You' : 'M'}
            </span>
            <div
              className={cn(
                'rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-1',
                isUser
                  ? 'rounded-tr-md bg-brand-600 text-white'
                  : 'rounded-tl-md border border-line bg-surface text-ink-soft',
              )}
            >
              <p className="eyebrow mb-1 text-[10px]">{isUser ? 'You' : conversationLabel}</p>
              {isUser ? (
                <p className="whitespace-pre-wrap">{item.message}</p>
              ) : (
                <MarkdownContent content={item.message} compact />
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function ChatThread({
  messages,
  runs,
  selectedRunId,
  onSelectRun,
  activePanel,
  onSelectPanel,
  hasConversation,
  conversationLabel = 'AI Mentor',
  onNewChat,
}) {
  const run = runs.find((item) => item.id === selectedRunId) || runs[0] || null;
  const activeSection = AGENT_SECTIONS.find((section) => section.key === activePanel);

  const stepStatuses = Object.fromEntries(
    (run?.steps || []).map((step) => [step.step_key, step]),
  );

  return (
    <div className="flex flex-col gap-4">
      <AnalysisStatus run={run} />

      {/* Segmented panel switch */}
      <nav
        aria-label="Workspace views"
        className="nice-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {AGENT_SECTIONS.map((section) => {
          const step = stepStatuses[section.key];
          const hasOutput = Boolean(step?.output || reportSection(run?.output || '', LEGACY_REPORT_HEADINGS[section.key]));
          const Icon = section.icon;
          const isActive = activePanel === section.key;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onSelectPanel(section.key)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-brand-600 text-white shadow-brand'
                  : 'border border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-subtle',
              )}
            >
              <Icon
                size={13}
                strokeWidth={isActive ? 2.2 : 1.85}
                className={isActive ? 'text-white' : 'text-ink-faint'}
                aria-hidden="true"
              />
              {section.label}
              {section.key !== 'mentor' && (
                <span
                  aria-label={hasOutput ? 'output available' : step?.status || 'not run'}
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    hasOutput
                      ? 'bg-success-500'
                      : step?.status === 'running'
                        ? 'animate-pulse-soft bg-sky-400'
                        : step?.status === 'failed'
                          ? 'bg-danger-500'
                          : 'bg-ink-faint/50',
                  )}
                />
              )}
            </button>
          );
        })}
      </nav>

      {activePanel === 'mentor' || !activeSection ? (
        <MentorConversation
          messages={messages}
          hasConversation={hasConversation}
          conversationLabel={conversationLabel}
          onNewChat={onNewChat}
        />
      ) : (
        <AgentReport run={run} section={activeSection} />
      )}

      {runs.length > 1 && (
        <div className="flex items-center gap-2 border-t border-line pt-4">
          <Badge tone="neutral">
            <BrainCircuit size={12} aria-hidden="true" />
            Analysis run
          </Badge>
          <select
            value={run?.id ?? ''}
            onChange={(event) => onSelectRun(Number(event.target.value))}
            className="h-8 cursor-pointer rounded-lg border border-line-strong bg-surface px-2.5 pr-7 text-[12.5px] text-ink outline-none focus:border-brand-500"
            aria-label="Choose analysis run"
          >
            {runs.map((item) => (
              <option key={item.id} value={item.id}>
                v{item.version} · {item.status}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[11.5px] text-ink-muted">
            {runs.length} saved versions
          </span>
        </div>
      )}
    </div>
  );
}
