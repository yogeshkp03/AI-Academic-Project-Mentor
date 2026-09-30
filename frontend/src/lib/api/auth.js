import { apiClient } from '../apiClient';

export const authApi = {
  login: (credentials) => apiClient.post('/students/login', credentials, { auth: false }),
  register: (payload) => apiClient.post('/students/register', payload, { auth: false }),
  me: () => apiClient.get('/students/me'),
  updateMe: (payload) => apiClient.patch('/students/me', payload),
  logout: () => apiClient.post('/students/logout'),
};