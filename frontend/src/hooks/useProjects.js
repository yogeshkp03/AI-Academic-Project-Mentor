import { projectsApi } from '../lib/api/projects';
import { session } from '../lib/session';
import { useAsync } from './useAsync';

export function useProjects(studentId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setData,
    setError,
  } = useAsync(() => projectsApi.listForStudent(studentId), {
    auto: Boolean(studentId) && Boolean(session.token),
    deps: [studentId],
  });

  const projects = data ?? [];

  const createProject = async ({ title, idea, technology_stack, duration }) => {
    const project = await projectsApi.create({
      student_id: studentId,
      title: title.trim(),
      idea: idea.trim(),
      technology_stack: technology_stack?.trim() || null,
      duration,
    });
    setData((previous) => [project, ...(previous || [])]);
    return project;
  };

  const deleteProject = async (projectId) => {
    await projectsApi.delete(projectId);
    setData((previous) => (previous || []).filter((project) => project.id !== projectId));
  };

  return {
    projects,
    loading,
    error,
    refetch,
    createProject,
    deleteProject,
    setProjects: setData,
    setError,
  };
}