import apiClient from './client';

export const contentAPI = {
  getAboutProject: async () => {
    const response = await apiClient.get('/about-project');
    return response.data;
  },

  updateAboutProject: async (content) => {
    const response = await apiClient.post('/about-project', { content });
    return response.data;
  },

  getExpertInstructions: async () => {
    const response = await apiClient.get('/expert-instructions');
    return response.data;
  },

  updateExpertInstructions: async (content) => {
    const response = await apiClient.post('/expert-instructions', { content });
    return response.data;
  },

  getNames: async () => {
    const response = await apiClient.get('/asana-names');
    return response.data;
  },
};

