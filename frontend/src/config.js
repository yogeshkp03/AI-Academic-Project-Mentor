export const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const AGENTS = [
  { key: 'mentor', label: 'AI Mentor' },
  { key: 'feasibility', label: 'Feasibility Agent' },
  { key: 'architect', label: 'Architect Agent' },
  { key: 'scope', label: 'Scope Agent' },
  { key: 'timeline', label: 'Timeline Agent' },
  { key: 'planning', label: 'Planning Agent' },
  { key: 'resource', label: 'Resource Agent' },
  { key: 'ui_ux', label: 'UI/UX Agent' },
  { key: 'professor', label: 'Professor QA Agent' },
];

export const RUN_STATUSES = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
};

export const POLLING = {
  intervalMs: 2000,
  maxAttempts: 150,
};

export const WORKSPACE_REFRESH_MS = 5000;