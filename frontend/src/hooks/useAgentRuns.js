import { useEffect, useRef } from 'react';
import { POLLING } from '../config';
import { runsApi } from '../lib/api/runs';
import { projectsApi } from '../lib/api/projects';
import { useAsync } from './useAsync';

export function useAllRuns(studentId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setError,
  } = useAsync(
    async () => {
      const projects = await projectsApi.listForStudent(studentId);
      // allSettled keeps one failing project (deleted/concurrent change) from
      // wiping the whole analytics view; fulfilled lists are still merged.
      const settled = await Promise.allSettled(
        projects.map((project) => runsApi.listForProject(project.id)),
      );
      return settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));
    },
    { auto: Boolean(studentId), deps: [studentId] },
  );

  const runs = data ?? [];

  return { runs, loading, error, refetch, setError };
}

const POLL_ABORTED = 'poll-aborted';

/**
 * Signals that a poll was cancelled rather than that something went wrong.
 * Callers must not surface this to the user: it is raised when the page
 * context changed or the user navigated away, which is normal behaviour.
 */
export class PollAbortedError extends Error {
  constructor() {
    super('Polling stopped.');
    this.name = POLL_ABORTED;
  }
}

export const isPollAborted = (error) => error?.name === POLL_ABORTED;

export function useAgentRuns(projectId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setData,
    setError,
  } = useAsync(() => (projectId ? runsApi.listForProject(projectId) : Promise.resolve([])), {
    auto: Boolean(projectId),
    deps: [projectId],
  });

  const runs = data ?? [];

  const contextRef = useRef({ projectId });

  useEffect(() => {
    contextRef.current = { projectId };
    return () => {
      contextRef.current = null;
    };
  }, [projectId]);

  const startAnalysis = async (targetProjectId = projectId) => {
    const run = await runsApi.startAnalysis(targetProjectId);
    setData((previous) => [run, ...(previous || [])]);
    return run;
  };

  const pollUntilDone = async (runId, { targetProjectId = projectId, intervalMs, maxAttempts, onUpdate } = {}) => {
    const stepMs = intervalMs ?? POLLING.intervalMs;
    const attempts = maxAttempts ?? POLLING.maxAttempts;

    contextRef.current = { projectId: targetProjectId };

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!contextRef.current || contextRef.current.projectId !== targetProjectId) {
        // Another poll took over the shared context slot, or the page unmounted.
        throw new PollAbortedError();
      }

      const list = await runsApi.listForProject(targetProjectId);
      setData(list);

      const current = list.find((item) => item.id === runId);
      if (current?.status === 'failed') {
        throw new Error(current.error_message || 'Analysis failed.');
      }
      if (current?.status === 'completed') {
        onUpdate?.(current);
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, stepMs));
    }
    throw new Error('Analysis is taking longer than expected. Check the AI Workspace to continue.');
  };

  return { runs, loading, error, refetch, setRuns: setData, setError, startAnalysis, pollUntilDone };
}