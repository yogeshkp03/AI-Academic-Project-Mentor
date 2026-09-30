import { useAuth } from '../context/useAuth';
import { useAllRuns } from '../hooks/useAgentRuns';
import { Card, EmptyState, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { formatCost } from '../lib/format';

function Tasks() {
  const { studentId } = useAuth();
  const { runs, loading } = useAllRuns(studentId);

  const sorted = [...runs].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return (
    <>
      <PageHeader title="Tasks 📋" subtitle="Track your AI analysis runs and their status." />

      <Card>
        {loading ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No analysis runs yet"
            message="Start one from the Projects or AI Workspace page."
          />
        ) : (
          <div className="flex flex-col">
            {sorted.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 py-4 transition last:border-0 hover:bg-slate-50/70"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    AI {run.agent_type} · v{run.version} · project #{run.project_id}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : 'in progress'}
                    {run.cost ? ` · ${formatCost(run.cost)}` : ''}
                  </p>
                </div>
                <StatusBadge status={run.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export default Tasks;