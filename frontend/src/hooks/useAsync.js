import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync(asyncFn, { auto = true, deps = [], onResult } = {}) {
  // Results are tagged with the deps they were fetched for. Data belonging to a
  // previous project is never handed back for a new one, so switching projects
  // cannot leave the old project's data on screen under the new heading while
  // the refetch is still in flight.
  const currentKey = JSON.stringify(deps);
  const [result, setResult] = useState({ key: currentKey, data: null, error: '' });
  const [loading, setLoading] = useState(Boolean(auto));
  const runIdRef = useRef(0);

  const setData = useCallback(
    (value) => {
      setResult((previous) => {
        const base = previous.key === currentKey ? previous.data : null;
        const next = typeof value === 'function' ? value(base) : value;
        return { key: currentKey, data: next, error: previous.error };
      });
    },
    [currentKey],
  );

  const setError = useCallback(
    (message) => {
      setResult((previous) => ({
        key: currentKey,
        data: previous.key === currentKey ? previous.data : null,
        error: message,
      }));
    },
    [currentKey],
  );

  const run = useCallback(
    async (...args) => {
      const runId = ++runIdRef.current;
      setLoading(true);
      setResult((previous) => ({
        key: currentKey,
        data: previous.key === currentKey ? previous.data : null,
        error: '',
      }));
      try {
        const value = await asyncFn(...args);
        if (runId === runIdRef.current) {
          setResult({ key: currentKey, data: value, error: '' });
          onResult?.(value);
        }
        return value;
      } catch (err) {
        if (runId === runIdRef.current) {
          setResult((previous) => ({
            key: currentKey,
            data: previous.key === currentKey ? previous.data : null,
            error: err.message || 'Something went wrong.',
          }));
        }
        throw err;
      } finally {
        if (runId === runIdRef.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...deps, currentKey, onResult],
  );

  useEffect(() => {
    if (auto) run().catch(() => {});
    return () => {
      // Invalidates in-flight requests whose result is no longer wanted.
      runIdRef.current += 1;
    };
  }, [auto, run]);

  const isCurrent = result.key === currentKey;

  return {
    data: isCurrent ? result.data : null,
    loading,
    setLoading,
    error: isCurrent ? result.error : '',
    setError,
    setData,
    run,
    refetch: run,
  };
}
