import apiClient from './client';

export const contentAPI = {
  getAboutProject: async () => {
    const response = await apiClient.get('/api/about-project');
    return response.data;
  },

  updateAboutProject: async (content) => {
    const response = await apiClient.post('/api/about-project', { content });
    return response.data;
  },

  getExpertInstructions: async () => {
    const response = await apiClient.get('/api/expert-instructions');
    return response.data;
  },

  updateExpertInstructions: async (content) => {
    const response = await apiClient.post('/api/expert-instructions', { content });
    return response.data;
  },

  getNames: async () => {
    const response = await apiClient.get('/api/asana-names');
    return response.data;
  },
};

