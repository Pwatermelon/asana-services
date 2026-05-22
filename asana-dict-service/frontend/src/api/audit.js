import apiClient from './client';

export const auditAPI = {
  getEvents: async (params = {}) => {
    const response = await apiClient.get('/api/audit/events', { params });
    return response.data;
  },
};
