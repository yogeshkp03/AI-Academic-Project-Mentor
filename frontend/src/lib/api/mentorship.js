import { apiClient } from '../apiClient';

export const mentorshipApi = {
  availableFaculty: () => apiClient.get('/mentorship/available-faculty'),
  myAppeals: () => apiClient.get('/mentorship/student-appeals'),
  createAppeal: (payload) => apiClient.post('/mentorship/student-appeals', payload),
};
