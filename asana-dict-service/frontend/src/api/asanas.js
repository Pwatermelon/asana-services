import apiClient from './client';

export const asanasAPI = {
  getAll: async () => {
    const response = await apiClient.get('/asanas');
    return response.data;
  },

  getByLetter: async (letter) => {
    const response = await apiClient.get(`/asanas/by-letter/${letter}`);
    return response.data;
  },

  getById: async (asanaId) => {
    // Получаем все асаны и находим нужную
    const allAsanas = await asanasAPI.getAll();
    const fullUri = asanaId.startsWith('http://') 
      ? asanaId 
      : `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${asanaId.startsWith('asana_') ? asanaId : `asana_${asanaId}`}`;
    return allAsanas.find(a => a.id === fullUri);
  },

  search: async (query, fuzzy = true) => {
    const response = await apiClient.get('/asanas/search', {
      params: { query, fuzzy },
    });
    return response.data;
  },

  getBySource: async (sourceId) => {
    const response = await apiClient.get(`/asanas/by-source/${sourceId}`);
    return response.data;
  },

  add: async (formData) => {
    const response = await apiClient.post('/asana', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  delete: async (asanaId) => {
    // Извлекаем короткий ID
    const shortId = asanaId.split('#').pop().replace('asana_', '');
    const response = await apiClient.delete(`/asanas/${shortId}`, {
      params: { uri: asanaId },
    });
    return response.data;
  },

  addPhoto: async (asanaId, photoFile, sourceId) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('source_id', sourceId);
    
    const shortId = asanaId.split('#').pop().replace('asana_', '');
    const response = await apiClient.post(`/asana/${shortId}/add-photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  checkPhoto: async (asanaId, sourceId) => {
    const shortId = asanaId.split('#').pop().replace('asana_', '');
    const response = await apiClient.get(`/asana/${shortId}/check-photo/${sourceId}`);
    return response.data;
  },
};

