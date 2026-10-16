import { Check, CircleDot, Loader, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/cn';
import { AGENT_STEP_LABELS } from '../../lib/agentRuns';

const STEP_ICONS = {
  completed: Check,
  running: Loader,
  failed: TriangleAlert,
  pending: CircleDot,
};

const STEP_TONES = {
  completed: 'text-success-600',
  running: 'text-brand-600',
  failed: 'text-danger-600',
  pending: 'text-ink-faint',
};

const STEP_LABELS = Object.fromEntries(
  AGENT_STEP_LABELS.map((step) => [step.key, step.label]),
);

/** The eight specialist stages, with their live status. */
export function AgentProgressList({ steps = [], compact = false }) {
  if (!steps.length) return null;
  return (
    <ol className={cn('grid min-w-0 gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
      {steps.map((step) => {
        const Icon = STEP_ICONS[step.status] || CircleDot;
        return (
          <li key={step.step_key} className="flex min-w-0 items-center gap-2 text-[12.5px]">
            <Icon
              size={13}
              strokeWidth={2.4}
              className={cn(
                'shrink-0',
                STEP_TONES[step.status] || 'text-ink-muted',
                step.status === 'running' && 'animate-spin',
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                step.status === 'failed' ? 'font-semibold text-danger-700' : 'text-ink-soft',
              )}
            >
              {STEP_LABELS[step.step_key] || step.step_key}
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-ink-faint capitalize">
              {step.status}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
