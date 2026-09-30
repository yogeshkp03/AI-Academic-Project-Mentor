import { StatusBadge } from '../ui';
import { formatCost, formatDuration } from '../../lib/format';

export function AnalysisHistory({ runs, onSelectRun, onRetry, selectedReport, busy }) {
  const latestRun = runs[0] || null;

  return (
    <>
      <p className="mb-2 text-xs font-bold tracking-wide text-slate-400 uppercase">
        Analysis History
      </p>
      {runs.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">No analyses for this project yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {runs.map((run) => (
            <li key={run.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectRun(run)}
                disabled={!run.output}
                className="min-w-0 flex-1 cursor-pointer rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="block truncate text-sm font-semibold text-slate-700">
                  v{run.version} <span className="font-normal text-slate-400">· project #{run.project_id}</span>
                </span>
                <span className="block text-xs text-slate-400">
                  {formatDuration(run.duration_ms)}
                  {formatCost(run.cost) ? ` · ${formatCost(run.cost)}` : ''}
                </span>
              </button>
              <span className="shrink-0">
                <StatusBadge status={run.status} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="mb-2 text-sm text-slate-500">
          {latestRun
            ? `Latest analysis: ${latestRun.status} (v${latestRun.version})`
            : 'No analysis run yet.'}
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={busy || !runs.length}
          className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ↻ Run Analysis Again
        </button>
      </div>

      {selectedReport && runs.length > 0 && (
        <button
          type="button"
          onClick={() => onSelectRun(latestRun)}
          className="mt-2 w-full cursor-pointer text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          View Latest Report
        </button>
      )}
    </>
  );
}