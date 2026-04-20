import apiClient from './client';

export const moderationAPI = {
  getItems: async (resolved = false, sortOptions = {}) => {
    const params = {
      resolved,
      sort: sortOptions.sort || 'created_at',
      sort_dir: sortOptions.sort_dir || 'desc',
    };
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

  exportItems: async () => {
    const response = await apiClient.get('/api/moderation/items/export', {
      responseType: 'blob',
    });
    
    // Создаем ссылку для скачивания
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    
    // Получаем имя файла из заголовков
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'moderation_export.xlsx';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

