import { apiClient } from '../apiClient';

export const runsApi = {
  startAnalysis: (projectId) => apiClient.post(`/projects/${projectId}/analysis`),
  startFromConversation: (conversationId) =>
    apiClient.post(`/conversations/${conversationId}/analysis`),
  listForProject: async (projectId) => {
    const runs = await apiClient.get(`/projects/${projectId}/agent-runs`);
    return Array.isArray(runs) ? runs : [];
  },
};