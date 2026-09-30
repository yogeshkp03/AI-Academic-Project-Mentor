import { useAuth } from '../context/useAuth';
import { useAllRuns } from '../hooks/useAgentRuns';
import { Card, EmptyState, PageHeader, Spinner, StatCard, StatusBadge } from '../components/ui';
import { formatCost } from '../lib/format';

function Analytics() {
  const { studentId } = useAuth();
  const { runs, loading } = useAllRuns(studentId);

  const total = runs.length;
  const completed = runs.filter((run) => run.status === 'completed').length;
  const failed = runs.filter((run) => run.status === 'failed').length;
  const active = runs.filter((run) => run.status === 'queued' || run.status === 'running').length;

  const completedRuns = runs.filter((run) => run.duration_ms != null);
  const totalSeconds = completedRuns.reduce((sum, run) => sum + run.duration_ms / 1000, 0);
  const avgSeconds = completedRuns.length > 0 ? `${(totalSeconds / completedRuns.length).toFixed(1)} s` : '—';
  const totalCost = runs.reduce((sum, run) => sum + (run.cost || 0), 0);

  return (
    <>
      <PageHeader title="Project Analytics 📊" subtitle="Understand your academic project performance." />

      {loading ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon="🧮" color="blue" label="Total Analyses" value={total} />
            <StatCard icon="✅" color="green" label="Completed" value={completed} />
            <StatCard icon="⏳" color="orange" label="Active / Failed" value={`${active} / ${failed}`} />
            <StatCard icon="⏱️" color="purple" label="Avg Duration" value={avgSeconds} />
          </div>

          {totalCost > 0 && (
            <div className="mt-4 max-w-xs">
              <StatCard icon="💰" color="slate" label="Estimated AI Cost" value={formatCost(totalCost)} />
            </div>
          )}

          <Card title="Analysis History" className="mt-6">
            {runs.length === 0 ? (
              <EmptyState
                icon="📊"
                title="No agent runs yet"
                message="Run an analysis from the Projects or AI Workspace page."
              />
            ) : (
              <div className="flex flex-col">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 py-4 transition last:border-0 hover:bg-slate-50/70"
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      v{run.version} · project #{run.project_id}
                    </span>
                    <span className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : ''}</span>
                      {formatCost(run.cost)}
                      <StatusBadge status={run.status} />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

export default Analytics;