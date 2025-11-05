import apiClient from './client';

export const moderationAPI = {
  getItems: async (resolved = false, moderation_type = null, object_type = null) => {
    const params = { resolved: resolved };
    if (moderation_type) {
      params.moderation_type = moderation_type;
    }
    if (object_type) {
      params.object_type = object_type;
    }
    const response = await apiClient.get('/moderation/items', { params });
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

  addAsanaFromModeration: async (itemId, nameId, sourceId, photoFile, keepPhotoFromRequest = false) => {
    const formData = new FormData();
    formData.append('name_id', nameId);
    formData.append('source_id', sourceId);
    formData.append('keep_photo_from_request', keepPhotoFromRequest ? 'true' : 'false');
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

