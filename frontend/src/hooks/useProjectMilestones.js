import { projectsApi } from '../lib/api/projects';
import { useAsync } from './useAsync';

export function useProjectMilestones(projectId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setData,
  } = useAsync(
    () => (projectId ? projectsApi.milestones(projectId) : Promise.resolve([])),
    { auto: Boolean(projectId), deps: [projectId] },
  );

  const updateMilestone = async (milestone, completed) => {
    const updated = await projectsApi.updateMilestone(projectId, milestone.id, { completed });
    setData((previous) =>
      (previous || []).map((item) => (item.id === updated.id ? updated : item)),
    );
    return updated;
  };

  return {
    milestones: data ?? [],
    loading,
    error,
    refetch,
    updateMilestone,
  };
}
