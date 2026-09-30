import { apiClient } from '../apiClient';

export const projectsApi = {
  create: (payload) => apiClient.post('/projects/', payload),
  listForStudent: (studentId) => apiClient.get(`/projects/student/${studentId}`),
};