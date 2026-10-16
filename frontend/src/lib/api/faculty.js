import { apiClient } from '../apiClient';
import { facultySession } from '../session/facultySession';

const authOptions = (token) => ({
  authToken: token,
  authFailurePath: '/faculty/login',
  onAuthFailure: () => facultySession.clear(),
});

export const facultyApi = {
  register: (payload) => apiClient.post('/faculty/register', payload, { auth: false }),
  login: (payload) => apiClient.post('/faculty/login', payload, { auth: false }),
  me: (token) => apiClient.get('/faculty/me', authOptions(token)),
  logout: (token) => apiClient.post('/faculty/logout', undefined, authOptions(token)),
  projects: (token) => apiClient.get('/faculty/projects', authOptions(token)),
  mentorAppeals: (token) => apiClient.get('/mentorship/faculty-appeals', authOptions(token)),
  updateMentorProfile: (token, payload) =>
    apiClient.patch('/faculty/mentor-profile', payload, authOptions(token)),
  decideMentorAppeal: (token, appealId, payload) =>
    apiClient.put(`/mentorship/faculty-appeals/${appealId}/decision`, payload, authOptions(token)),
  saveEvaluation: (token, projectId, payload) =>
    apiClient.put(`/faculty/projects/${projectId}/evaluation`, payload, authOptions(token)),
};
