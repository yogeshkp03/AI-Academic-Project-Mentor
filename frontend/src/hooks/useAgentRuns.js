import { useCallback, useEffect, useMemo, useRef } from 'react';
import { POLLING } from '../config';
import { ApiError } from '../lib/apiClient';
import { runsApi } from '../lib/api/runs';
import { projectsApi } from '../lib/api/projects';
import { useAsync } from './useAsync';

export function useAllRuns(studentId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setData,
    setError,
  } = useAsync(
    async () => {
      const projects = await projectsApi.listForStudent(studentId);
      // allSettled keeps one failing project (deleted/concurrent change) from
      // wiping the whole analytics view; fulfilled lists are still merged.
      const settled = await Promise.allSettled(
        projects.map((project) => runsApi.listForProject(project.id)),
      );
      return {
        runs: settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : [])),
        failedProjectIds: settled.flatMap((entry, index) =>
          entry.status === 'rejected' ? [projects[index].id] : [],
        ),
      };
    },
    { auto: Boolean(studentId), deps: [studentId] },
  );

  const runs = useMemo(() => data?.runs ?? [], [data?.runs]);
  const failedProjectIds = data?.failedProjectIds ?? [];
  const setRuns = useCallback((value) => {
    setData((previous) => {
      const current = previous?.runs ?? [];
      const nextRuns = typeof value === 'function' ? value(current) : value;
      return {
        runs: nextRuns,
        failedProjectIds: previous?.failedProjectIds ?? [],
      };
    });
  }, [setData]);

  useEffect(() => {
    if (!runs.some((run) => run.status === 'queued' || run.status === 'running')) {
      return undefined;
    }
    let cancelled = false;
    let timer;
    const refresh = async () => {
      try {
        await refetch();
      } catch {
        // The hook exposes the error; the timer keeps trying while the run is active.
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 5000);
      }
    };
    timer = setTimeout(refresh, 5000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runs, refetch]);

  return { runs, failedProjectIds, loading, error, refetch, setError, setRuns };
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

  const startAnalysis = useCallback(async (targetProjectId = projectId) => {
    const run = await runsApi.startAnalysis(targetProjectId);
    setData((previous) => [run, ...(previous || [])]);
    return run;
  }, [projectId, setData]);

  const startConversationAnalysis = useCallback(async (conversationId) => {
    const run = await runsApi.startFromConversation(conversationId);
    setData((previous) => [run, ...(previous || [])]);
    return run;
  }, [setData]);

  const pollUntilDone = useCallback(async (
    runId,
    { targetProjectId = projectId, intervalMs, maxAttempts, onUpdate } = {},
  ) => {
    let delayMs = intervalMs ?? POLLING.intervalMs;
    let attempt = 0;

    contextRef.current = { projectId: targetProjectId };

    while (maxAttempts === undefined || attempt < maxAttempts) {
      if (!contextRef.current || contextRef.current.projectId !== targetProjectId) {
        throw new PollAbortedError();
      }

      let list;
      try {
        list = await runsApi.listForProject(targetProjectId);
      } catch (error) {
        if (error instanceof ApiError && error.status < 500) throw error;
        delayMs = Math.min(delayMs * 2, 10000);
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      setData(list);
      const current = list.find((item) => item.id === runId);
      if (current?.status === 'failed') {
        throw new Error(current.error_message || 'Analysis failed.');
      }
      if (current?.status === 'completed') {
        onUpdate?.(current);
        return current;
      }

      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 1.25, 10000);
    }
    throw new Error('Stopped monitoring this analysis. The backend run may still be active.');
  }, [projectId, setData]);

  return {
    runs,
    loading,
    error,
    refetch,
    setRuns: setData,
    setError,
    startAnalysis,
    startConversationAnalysis,
    pollUntilDone,
  };
}