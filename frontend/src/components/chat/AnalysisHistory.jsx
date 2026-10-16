import { FileDown, FileText, Loader2, RefreshCw } from 'lucide-react';
import { formatCost, formatDuration } from '../../lib/format';
import { AgentProgressList } from './AgentProgressList';
import { StatusBadge } from '../ui';
import { ANALYSIS_STEP_COUNT } from '../../lib/agentRuns';

const EXPECTED_STEP_COUNT = ANALYSIS_STEP_COUNT;

export function AnalysisHistory({
  runs,
  onSelectRun,
  onSelectLatest,
  onRetry,
  onDownload,
  selectedRunId,
  busy,
}) {
  const latestRun = runs[0] || null;
  const latestHasAgentOutput = Boolean(
    latestRun?.output || latestRun?.steps?.some((step) => step.output),
  );
  const stalledFinalization =
    latestRun?.status === 'failed' &&
    latestRun.steps?.length === EXPECTED_STEP_COUNT &&
    latestRun.steps.every((step) => step.status === 'completed');

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="grid size-10 place-items-center rounded-xl border border-line bg-subtle text-ink-faint">
          <Loader2 size={17} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="text-[13px] font-semibold text-ink-soft">No analyses yet</p>
        <p className="max-w-48 text-[12px] leading-relaxed text-ink-muted">
          Run one from the Projects page and each specialist report lands here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {runs.map((run) => {
          const selected = run.id === selectedRunId;
          const updatedFromChat = run.input_context?.startsWith('[AI_MENTOR_PLAN_UPDATE]');
          const hasReport = Boolean(
            run.output?.trim() || run.steps?.some((step) => step.output?.trim()),
          );
          return (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onSelectRun(run)}
                className={`w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  selected
                    ? 'border-brand-200 bg-brand-50'
                    : 'border-transparent hover:border-line hover:bg-subtle/60'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[13.5px] font-semibold ${selected ? 'text-brand-700' : 'text-ink'}`}
                  >
                    v{run.version}
                  </span>
                  <StatusBadge status={run.status} />
                </span>
                <span className="mt-1 block text-[11.5px] text-ink-muted tabular">
                  {(formatDuration(run.duration_ms) || 'not timed') +
                    (formatCost(run.cost) ? ` · ${formatCost(run.cost)}` : '')}
                </span>
                {updatedFromChat && (
                  <span className="mt-1 block text-[11px] font-medium text-brand-700">
                    Updated from AI Mentor chat
                  </span>
                )}
              </button>
              {run.steps?.length > 0 && (
                <div className="mt-1.5 mb-2 pl-1">
                  <AgentProgressList steps={run.steps} compact />
                </div>
              )}
              {hasReport && (
                <div className="mb-2 flex gap-2 pl-1">
                  <button
                    type="button"
                    onClick={() => onDownload(run, 'md')}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-line px-2 text-[11px] font-semibold text-ink-soft hover:bg-subtle"
                    aria-label={`Download version ${run.version} as Markdown`}
                  >
                    <FileText size={12} aria-hidden="true" />
                    .MD
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownload(run, 'pdf')}
                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-line px-2 text-[11px] font-semibold text-ink-soft hover:bg-subtle"
                    aria-label={`Download version ${run.version} as PDF`}
                  >
                    <FileDown size={12} aria-hidden="true" />
                    PDF
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <p className="text-[12px] leading-relaxed text-ink-muted">
          {stalledFinalization
            ? `All ${EXPECTED_STEP_COUNT} agent tasks finished on v${latestRun.version}, but the combined report could not be finalised. Every specialist output is still saved below.`
            : `Latest analysis: v${latestRun.version}, ${latestRun.status}.`}
        </p>
        <button
          type="button"
          onClick={onRetry}
          disabled={busy || latestRun?.status === 'queued' || latestRun?.status === 'running'}
          className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink-soft transition-colors hover:border-ink-faint hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {latestRun?.status === 'failed' ? 'Run a fresh analysis' : 'Run analysis again'}
        </button>
        {latestHasAgentOutput && (
          <button
            type="button"
            onClick={onSelectLatest}
            className="cursor-pointer self-start bg-transparent p-0 text-[12.5px] font-semibold text-brand-700 underline decoration-brand-200 decoration-2 underline-offset-3 hover:text-brand-800"
          >
            Open the latest agent outputs
          </button>
        )}
      </div>
    </div>
  );
}
