import apiClient from './client';

export const sourcesAPI = {
  getAll: async () => {
    const response = await apiClient.get('/api/sources');
    return response.data;
  },

  getById: async (sourceId) => {
    const allSources = await sourcesAPI.getAll();
    const shortId = sourceId.split('#').pop().replace('source_', '');
    return allSources.find(s => {
      const sId = s.id.split('#').pop().replace('source_', '');
      return sId === shortId;
    });
  },

  search: async (query) => {
    const response = await apiClient.get('/api/sources/search', {
      params: { query },
    });
    return response.data;
  },

  add: async (sourceData) => {
    const response = await apiClient.post('/api/sources', sourceData);
    return response.data;
  },

  delete: async (sourceId) => {
    const response = await apiClient.delete('/api/delete-source', {
      params: { uri: sourceId },
    });
    return response.data;
  },
};

