import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  CircleSlash,
  Clock3,
  Coins,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useAllRuns } from '../hooks/useAgentRuns';
import { formatDuration, latestRunFor } from '../lib/agentRuns';
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Message,
  PageHeader,
  SkeletonList,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { formatCost } from '../lib/format';

export default function Analytics() {
  const { studentId } = useAuth();
  const { runs, failedProjectIds, loading, error, refetch } = useAllRuns(studentId);

  const total = runs.length;
  const completed = runs.filter((run) => run.status === 'completed').length;
  const failed = runs.filter((run) => run.status === 'failed').length;
  const active = runs.filter((run) => run.status === 'queued' || run.status === 'running').length;

  const timed = runs.filter((run) => run.duration_ms != null);
  const avgMs = timed.length ? timed.reduce((s, r) => s + r.duration_ms, 0) / timed.length : null;
  const totalCost = runs.reduce((sum, run) => sum + (run.cost || 0), 0);
  const successRate = total ? Math.round((completed / total) * 100) : 0;

  // Per-project rollup, most recent first
  const byProject = useMemo(() => {
    const map = new Map();
    runs.forEach((run) => {
      if (!map.has(run.project_id)) map.set(run.project_id, []);
      map.get(run.project_id).push(run);
    });
    return [...map.entries()]
      .map(([projectId, list]) => ({ projectId, latest: latestRunFor(list, projectId), count: list.length }))
      .sort((a, b) => (b.latest?.created_at || '').localeCompare(a.latest?.created_at || ''));
  }, [runs]);

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Where your time went"
        subtitle="Every analysis run you have triggered, with the time and model cost it took."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-subtle"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      {(error || failedProjectIds.length > 0) && (
        <Message type="warning" className="my-4">
          {error?.message ||
            `Analysis history could not load for ${failedProjectIds.length} project${failedProjectIds.length > 1 ? 's' : ''}.`}{' '}
          <button
            type="button"
            onClick={() => refetch()}
            className="ml-1 cursor-pointer bg-transparent p-0 font-bold underline"
          >
            Try again
          </button>
        </Message>
      )}

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        <StatCard icon={BarChart3} label="Analyses run" value={total} tone="brand" />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completed}
          tone="success"
          delta={total ? `${successRate}% success rate` : undefined}
          deltaTone={successRate >= 80 ? 'up' : 'down'}
        />
        <StatCard
          icon={Clock3}
          label="Average run"
          value={avgMs ? formatDuration(avgMs) : '—'}
          tone="info"
          hint={`${timed.length} timed run${timed.length === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Coins}
          label="Model cost"
          value={formatCost(totalCost)}
          tone="ochare"
          hint="estimated across all runs"
        />
      </div>

      {active > 0 && (
        <Message type="brand" className="mt-4">
          <span className="inline-flex items-center gap-2">
            <TrendingUp size={14} aria-hidden="true" />
            {active} {active === 1 ? 'analysis is' : 'analyses are'} still working. Numbers update as
            they finish.
          </span>
        </Message>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <Card>
          <CardHeader
            icon={BarChart3}
            title="Run history"
            subtitle="Newest versions first. Failed runs are kept so you can see what happened."
          />
          {loading && runs.length === 0 ? (
            <CardBody>
              <SkeletonList rows={4} />
            </CardBody>
          ) : runs.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={CircleSlash}
                eyebrow="Nothing recorded"
                title="No analyses yet"
                message="Run one from the Projects page or the AI Planner, and the timing and cost of each specialist team appears here."
                action={
                  <Link
                    to="/projects"
                    className="inline-flex h-9 items-center rounded-[9px] bg-brand-600 px-4 text-[13px] font-semibold text-white no-underline shadow-brand transition-colors hover:bg-brand-700"
                  >
                    Go to projects
                  </Link>
                }
              />
            </CardBody>
          ) : (
            <div className="nice-scroll max-h-[32rem] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-subtle text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                  <tr>
                    <th className="px-5 py-2.5">Project</th>
                    <th className="px-3 py-2.5">Version</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Cost</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs
                    .slice()
                    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                    .map((run) => (
                      <tr key={run.id} className="transition-colors hover:bg-subtle/50">
                        <td className="px-5 py-3 text-[13px] font-semibold text-ink">
                          #{run.project_id}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-ink-soft tabular">v{run.version}</td>
                        <td className="px-3 py-3 text-[13px] text-ink-soft tabular">
                          {formatDuration(run.duration_ms) || '—'}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-ink-soft tabular">
                          {formatCost(run.cost)}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={run.status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card variant="inset">
          <CardHeader icon={TrendingUp} title="By project" />
          <CardBody>
            {byProject.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No projects have been analysed yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {byProject.map((row) => (
                  <li key={row.projectId} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">Project #{row.projectId}</p>
                      <p className="text-[11.5px] text-ink-muted tabular">
                        {row.count} run{row.count === 1 ? '' : 's'}
                      </p>
                    </div>
                    <StatusBadge status={row.latest?.status || 'queued'} />
                  </li>
                ))}
              </ul>
            )}
            {failed > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-[12px] leading-relaxed text-warning-700">
                <TriangleAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
                {failed} run{failed === 1 ? '' : 's'} failed. Provider limits are the usual cause —
                retrying is often enough.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
