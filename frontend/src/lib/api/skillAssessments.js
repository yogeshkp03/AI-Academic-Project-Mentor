import { apiClient } from '../apiClient';

export const skillAssessmentsApi = {
  start: () => apiClient.post('/skill-assessments/attempts'),
  resume: (attemptId) => apiClient.get(`/skill-assessments/attempts/${attemptId}`),
  saveDraft: (attemptId, answers) =>
    apiClient.patch(`/skill-assessments/attempts/${attemptId}/answers`, { answers }),
  submit: (attemptId, answers) =>
    apiClient.post(`/skill-assessments/attempts/${attemptId}/submit`, { answers }),
  listAttempts: () => apiClient.get('/skill-assessments/attempts'),
};
