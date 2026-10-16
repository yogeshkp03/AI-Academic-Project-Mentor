import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  FolderKanban,
  GaugeCircle,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAllRuns } from '../hooks/useAgentRuns';
import { ANALYSIS_STEP_COUNT, latestRunFor, toStepRail } from '../lib/agentRuns';
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LoadingCover,
  Message,
  PageHeader,
  Section,
  StepRail,
  StatCard,
  StatusBadge,
} from '../components/ui';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Working late';
}

export default function Dashboard() {
  const { studentId, studentName } = useAuth();
  const { projects, loading, error, refetch } = useProjects(studentId);
  const {
    runs,
    failedProjectIds,
    error: runsError,
    refetch: refetchRuns,
  } = useAllRuns(studentId);

  const stats = useMemo(() => {
    const analyzed = projects.filter(
      (project) => project.ai_report || latestRunFor(runs, project.id)?.status === 'completed',
    ).length;
    const active = runs.filter((run) => run.status === 'running' || run.status === 'queued').length;
    return {
      total: projects.length,
      analyzed,
      runs: runs.length,
      active,
    };
  }, [projects, runs]);

  // The one project the student should look at next
  const focus = useMemo(() => {
    const running = projects.find((p) => {
      const run = latestRunFor(runs, p.id);
      return run && (run.status === 'running' || run.status === 'queued');
    });
    if (running) return { project: running, reason: 'An analysis is working on this right now.' };
    const unanalyzed = projects.find(
      (p) => !p.ai_report && latestRunFor(runs, p.id)?.status !== 'completed',
    );
    if (unanalyzed) return { project: unanalyzed, reason: 'This one has no blueprint yet.' };
    const failed = projects.find((p) => latestRunFor(runs, p.id)?.status === 'failed');
    if (failed) return { project: failed, reason: 'Its last analysis did not finish.' };
    return projects[0]
      ? {
          project: projects[0],
          reason: 'Your most recent work — open the workspace to continue.',
        }
      : null;
  }, [projects, runs]);

  const attention = useMemo(() => {
    const items = [];
    projects.forEach((project) => {
      const run = latestRunFor(runs, project.id);
      if (run?.status === 'failed') {
        items.push({ project, tone: 'danger', text: 'Analysis did not finish' });
      } else if (!project.ai_report && run?.status !== 'completed') {
        items.push({ project, tone: 'warning', text: 'No blueprint yet' });
      }
    });
    return items.slice(0, 3);
  }, [projects, runs]);

  const showSkeleton = loading && projects.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`${greeting()}, ${studentName || 'there'}.`}
        subtitle="Here is the state of your academic projects, in the order you should care about them."
        actions={
          <>
            <ButtonLink to="/projects" variant="secondary" size="sm">
              All projects
            </ButtonLink>
            <ButtonLink to="/ai-planner" size="sm" iconRight={ArrowRight}>
              New analysis
            </ButtonLink>
          </>
        }
      />

      {(error || runsError || failedProjectIds.length > 0) && (
        <Message type="warning" className="mb-5">
          {error?.message ||
            runsError?.message ||
            `Analysis history could not load for ${failedProjectIds.length} project${failedProjectIds.length > 1 ? 's' : ''}. Other data is still accurate.`}{' '}
          <button
            type="button"
            onClick={() => Promise.allSettled([refetch(), refetchRuns()])}
            className="cursor-pointer bg-transparent p-0 font-bold underline"
          >
            Try again
          </button>
        </Message>
      )}

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard icon={FolderKanban} label="Projects" value={stats.total} tone="brand" />
        <StatCard
          icon={BookOpenCheck}
          label="Analysed"
          value={stats.total ? `${stats.analyzed}/${stats.total}` : '0'}
          tone="success"
          hint={stats.total ? 'blueprints saved' : 'nothing submitted yet'}
        />
        <StatCard
          icon={BrainCircuit}
          label="Analyses run"
          value={stats.runs}
          tone="info"
          hint={stats.runs ? 'all versions kept' : undefined}
        />
        <StatCard
          icon={GaugeCircle}
          label="Working now"
          value={stats.active}
          tone="ochre"
          hint={stats.active ? 'updating live' : 'queue is clear'}
        />
      </div>

      {showSkeleton ? (
        <div className="mt-6">
          <LoadingCover label="Loading your projects…" />
        </div>
      ) : !focus ? (
        <Section className="mt-8">
          <EmptyState
            icon={Sparkles}
            eyebrow="First run"
            title="Every blueprint starts with one paragraph"
            message="Describe what you want to build — idea, tech stack, and how long you have. Eight specialists will take it from there."
            mood="first-run"
            action={
              <ButtonLink to="/ai-planner" iconRight={ArrowRight}>
                Describe my project
              </ButtonLink>
            }
          />
        </Section>
      ) : (
        <>
          {/* Resume card */}
          <Card variant="accent" className="mt-6 overflow-hidden">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="eyebrow eyebrow-accent">Continue where you left off</p>
                <h2 className="mt-1.5 font-display text-[19px] leading-snug font-semibold text-ink">
                  {focus.project.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
                  {focus.project.idea}
                </p>
                <p className="mt-2 text-[12.5px] text-ink-muted">{focus.reason}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:w-44">
                {(() => {
                  const run = latestRunFor(runs, focus.project.id);
                  if (run?.status === 'completed' || focus.project.ai_report) {
                    return (
                      <ButtonLink to="/ai-mentor" iconRight={ArrowRight}>
                        Open AI Workspace
                      </ButtonLink>
                    );
                  }
                  if (run && (run.status === 'running' || run.status === 'queued')) {
                    return (
                      <ButtonLink to="/projects" variant="secondary">
                        Watch progress
                      </ButtonLink>
                    );
                  }
                  return (
                    <ButtonLink to="/ai-planner" iconRight={ArrowRight}>
                      Run an analysis
                    </ButtonLink>
                  );
                })()}
                <ButtonLink to="/tasks" variant="subtle" size="sm">
                  Milestones & check-ins
                </ButtonLink>
              </div>
            </div>
          </Card>

          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {/* Project list */}
            <Card className="lg:col-span-2">
              <CardHeader
                title="Your projects"
                subtitle="Status reflects the most recent analysis for each."
                actions={
                  <Link
                    to="/projects"
                    className="text-[13px] font-semibold text-brand-700 no-underline hover:text-brand-800"
                  >
                    View all →
                  </Link>
                }
              />
              {projects.length === 0 ? (
                <CardBody>
                  <EmptyState
                    icon={FolderKanban}
                    title="Nothing here yet"
                    message="Projects you create will appear here with their blueprint status."
                  />
                </CardBody>
              ) : (
                <ul className="divide-y divide-line">
                  {projects.slice(0, 4).map((project) => {
                    const run = latestRunFor(runs, project.id);
                    const analyzed = Boolean(project.ai_report) || run?.status === 'completed';
                    return (
                      <li key={project.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-[14px] font-semibold text-ink">
                              {project.title}
                            </h3>
                            <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-muted">
                              {project.idea}
                            </p>
                          </div>
                          <StatusBadge
                            status={run?.status || (analyzed ? 'completed' : 'queued')}
                          >
                            {analyzed && !run ? 'Blueprinted' : undefined}
                          </StatusBadge>
                        </div>

                        {run && run.steps?.length > 0 ? (
                          <StepRail className="mt-3" steps={toStepRail(run)} />
                        ) : (
                          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong">
                            <div
                              className={`h-full rounded-full ${analyzed ? 'w-full bg-success-500' : 'w-0'}`}
                            />
                          </div>
                        )}

                        <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-ink-muted">
                          <span>{ANALYSIS_STEP_COUNT} specialist stages</span>
                          {run?.duration_ms ? (
                            <span className="tabular">
                              {(run.duration_ms / 1000 / 60).toFixed(1)} min
                            </span>
                          ) : null}
                          <Link
                            to={analyzed ? '/ai-mentor' : '/ai-planner'}
                            className="ml-auto font-semibold text-brand-700 no-underline hover:text-brand-800"
                          >
                            {analyzed ? 'Open →' : 'Analyse →'}
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Attention */}
            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader
                  icon={TriangleAlert}
                  title="Needs you"
                  subtitle="Derived from your projects and analyses."
                />
                <CardBody>
                  {attention.length === 0 ? (
                    <p className="text-[13px] leading-relaxed text-ink-muted">
                      Nothing is stuck. Every project has a blueprint, and no analysis is
                      failing — that is a good place to be.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {attention.map((item) => (
                        <li
                          key={item.project.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-line bg-subtle/60 px-3.5 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink">
                              {item.project.title}
                            </p>
                            <p className="text-[11.5px] text-ink-muted">{item.text}</p>
                          </div>
                          <Badge tone={item.tone === 'danger' ? 'danger' : 'warning'}>
                            {item.tone === 'danger' ? 'Fix' : 'Plan'}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card variant="ochre">
                <CardHeader icon={Sparkles} title="Where to go next" />
                <CardBody>
                  <ul className="flex flex-col gap-2 text-[13px]">
                    {[
                      { to: '/ai-mentor', label: 'Ask a specialist why it decided something' },
                      { to: '/tasks', label: 'Log this week’s check-in' },
                      { to: '/skill-assessment', label: 'Check your skills against the plan' },
                      { to: '/analytics', label: 'See where your time actually goes' },
                    ].map((item) => (
                      <li key={item.to}>
                        <Link
                          to={item.to}
                          className="group flex items-center justify-between gap-2 text-ink-soft no-underline transition-colors hover:text-brand-700"
                        >
                          {item.label}
                          <ArrowRight
                            size={13}
                            className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
