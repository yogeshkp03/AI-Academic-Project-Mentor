import { apiClient } from '../apiClient';

export const projectsApi = {
  create: (payload) => apiClient.post('/projects/', payload),
  listForStudent: (studentId) => apiClient.get(`/projects/student/${studentId}`),
  delete: (projectId) => apiClient.delete(`/projects/${projectId}`),
  milestones: (projectId) => apiClient.get(`/projects/${projectId}/milestones`),
  updateMilestone: (projectId, milestoneId, payload) =>
    apiClient.patch(`/projects/${projectId}/milestones/${milestoneId}`, payload),
  risks: (projectId) => apiClient.get(`/projects/${projectId}/risks`),
  assessRisks: (projectId) => apiClient.post(`/projects/${projectId}/risks/assess`),
  updateRisk: (projectId, riskId, payload) =>
    apiClient.patch(`/projects/${projectId}/risks/${riskId}`, payload),
  checkIns: (projectId) => apiClient.get(`/projects/${projectId}/check-ins`),
  createCheckIn: (projectId, payload) =>
    apiClient.post(`/projects/${projectId}/check-ins`, payload),
  planProposals: (projectId) => apiClient.get(`/projects/${projectId}/plan-proposals`),
  createPlanProposal: (projectId, checkInId) =>
    apiClient.post(`/projects/${projectId}/check-ins/${checkInId}/plan-proposals`),
  decidePlanProposal: (projectId, proposalId, decision) =>
    apiClient.patch(`/projects/${projectId}/plan-proposals/${proposalId}`, { decision }),
};