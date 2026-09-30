import { RUN_STATUSES } from '../config';

export function formatDuration(durationMs) {
  const value = Number(durationMs);
  if (!Number.isFinite(value) || value <= 0) return '—';
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

export function formatCost(cost) {
  const value = Number(cost);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `$${value.toFixed(4)}`;
}

export function statusLabel(status) {
  return RUN_STATUSES[status] || status;
}

export const isActiveStatus = (status) => status === 'queued' || status === 'running';