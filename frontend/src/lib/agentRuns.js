/**
 * Shared helpers for analysis runs.
 * The eight specialist stages are the product's spine — they are defined once, here.
 */

export const AGENT_STEP_LABELS = [
  { key: 'feasibility', label: 'Feasibility' },
  { key: 'architect', label: 'Architecture' },
  { key: 'scope', label: 'MVP scope' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'ui_ux', label: 'UI/UX' },
  { key: 'planning', label: 'Execution plan' },
  { key: 'professor', label: 'QA review' },
  { key: 'resource', label: 'Learning resources' },
];

export const ANALYSIS_STEP_COUNT = AGENT_STEP_LABELS.length;

export const isActiveStatus = (status) => status === 'queued' || status === 'running';

/** The most recent run for a project. */
export function latestRunFor(runs, projectId) {
  return [...runs]
    .filter((run) => run.project_id === projectId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
}

/** Human-readable duration for a run's `duration_ms`. */
export function formatDuration(ms) {
  if (ms == null) return null;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 1000 / 60).toFixed(1)} min`;
}

/** Maps run steps onto the canonical stage list, for StepRail rendering. */
export function toStepRail(run) {
  return AGENT_STEP_LABELS.map((entry) => ({
    key: entry.key,
    label: entry.label,
    status: run?.steps?.find((step) => step.step_key === entry.key)?.status || 'pending',
  }));
}
