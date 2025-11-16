import apiClient from './client';

export const moderationAPI = {
  getItems: async (resolved = false) => {
    const params = { resolved: resolved };
    const response = await apiClient.get('/api/moderation/items', { params });
    return response.data;
  },

  getItemsCount: async () => {
    const response = await apiClient.get('/api/moderation/items/count');
    return response.data;
  },

  resolveItem: async (itemId) => {
    const response = await apiClient.patch(`/api/moderation/items/${itemId}/resolve`);
    return response.data;
  },

  addAsanaFromModeration: async (itemId, nameId, sourceId, photoFile, keepPhotoFromRequest = false) => {
    const formData = new FormData();
    formData.append('name_id', nameId);
    formData.append('source_id', sourceId);
    formData.append('keep_photo_from_request', keepPhotoFromRequest ? 'true' : 'false');
    if (photoFile) {
      formData.append('photo', photoFile);
    }
    
    const response = await apiClient.post(`/api/moderation/items/${itemId}/add-asana`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

