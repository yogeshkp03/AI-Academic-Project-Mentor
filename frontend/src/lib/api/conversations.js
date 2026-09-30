import { apiClient } from '../apiClient';

export const conversationsApi = {
  create: (projectId, payload) => apiClient.post(`/projects/${projectId}/conversations`, payload),
  list: (projectId) => apiClient.get(`/projects/${projectId}/conversations`),
  rename: (conversationId, payload) => apiClient.patch(`/conversations/${conversationId}`, payload),
  delete: (conversationId) => apiClient.delete(`/conversations/${conversationId}`),
  messages: (conversationId) => apiClient.get(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, payload) => apiClient.post(`/conversations/${conversationId}/messages`, payload),
};