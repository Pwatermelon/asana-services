import apiClient from './client';

export const moderationAPI = {
  getItems: async (resolved = false) => {
    const response = await apiClient.get('/moderation/items', {
      params: { resolved: resolved }
    });
    return response.data;
  },

  getItemsCount: async () => {
    const response = await apiClient.get('/moderation/items/count');
    return response.data;
  },

  resolveItem: async (itemId) => {
    const response = await apiClient.patch(`/moderation/items/${itemId}/resolve`);
    return response.data;
  },

  addAsanaFromModeration: async (itemId, nameId, sourceId, photoFile) => {
    const formData = new FormData();
    formData.append('name_id', nameId);
    formData.append('source_id', sourceId);
    if (photoFile) {
      formData.append('photo', photoFile);
    }
    
    const response = await apiClient.post(`/moderation/items/${itemId}/add-asana`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

