import apiClient from './client';

/** Axios по умолчанию ставит application/json — для FormData нужно убрать Content-Type, иначе boundary не подставится. */
const formDataConfig = {
  transformRequest: [
    (data, headers) => {
      if (data instanceof FormData) {
        delete headers['Content-Type'];
      }
      return data;
    },
  ],
};

export const asanasAPI = {
  getAll: async () => {
    const response = await apiClient.get('/api/asanas');
    return response.data;
  },

  /** Главная каталога: только id и название (быстро). */
  getCatalog: async () => {
    const response = await apiClient.get('/api/asanas', { params: { view: 'catalog' } });
    return response.data;
  },

  getByNameRu: async (nameRu) => {
    const response = await apiClient.get('/api/asanas/by-name', {
      params: { name_ru: nameRu },
    });
    return response.data;
  },

  getByLetter: async (letter) => {
    const response = await apiClient.get(`/api/asanas/by-letter/${letter}`);
    return response.data;
  },

  getById: async (asanaId) => {
    // Убираем суффикс -page если есть
    let cleanId = asanaId;
    if (cleanId.endsWith('-page')) {
      cleanId = cleanId.replace('-page', '');
    }
    
    try {
      // Пробуем использовать API endpoint
      const response = await apiClient.get(`/api/asana/${encodeURIComponent(cleanId)}`);
      return response.data;
    } catch (error) {
      // Fallback: получаем все асаны и находим нужную
      console.warn('Direct API call failed, using getAll fallback:', error);
      const allAsanas = await asanasAPI.getAll();
      const fullUri = cleanId.startsWith('http://') 
        ? cleanId 
        : `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${cleanId.startsWith('asana_') ? cleanId : `asana_${cleanId}`}`;
      
      // Ищем по разным вариантам ID
      let found = allAsanas.find(a => a.id === fullUri);
      if (!found) {
        // Пробуем найти по короткому ID
        const shortId = fullUri.split('#').pop();
        found = allAsanas.find(a => {
          const aShortId = a.id.split('#').pop();
          return aShortId === shortId || aShortId === cleanId || a.id === cleanId;
        });
      }
      return found;
    }
  },

  search: async (query, fuzzy = true) => {
    const response = await apiClient.get('/api/asanas/search', {
      params: { query, fuzzy },
    });
    return response.data;
  },

  getBySource: async (sourceId) => {
    const response = await apiClient.get(`/api/asanas/by-source/${sourceId}`);
    return response.data;
  },

  add: async (formData) => {
    const response = await apiClient.post('/api/asana', formData, formDataConfig);
    return response.data;
  },

  delete: async (asanaId) => {
    const response = await apiClient.delete('/api/asanas', {
      params: { uri: asanaId },
    });
    return response.data;
  },

  addPhoto: async (asanaId, photoFile, sourceId) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('source_id', sourceId);
    
    const shortId = asanaId.split('#').pop().replace('asana_', '');
    const response = await apiClient.post(`/api/asana/${shortId}/add-photo`, formData, formDataConfig);
    return response.data;
  },

  checkPhoto: async (asanaId, sourceId) => {
    const shortId = asanaId.split('#').pop().replace('asana_', '');
    const response = await apiClient.get(`/api/asana/${shortId}/check-photo/${sourceId}`);
    return response.data;
  },

  // Методы для работы с isSameAsObject
  getSimilarAsanas: async (asanaId) => {
    try {
      const shortId = asanaId.split('#').pop();
      const response = await apiClient.get(`/api/asana/${encodeURIComponent(shortId)}/similar`);
      return response.data;
    } catch (error) {
      console.error('Error getting similar asanas:', error);
      return [];
    }
  },

  setSameAsObject: async (asanaId, targetAsanaId) => {
    const shortId = asanaId.split('#').pop();
    const targetShortId = targetAsanaId.split('#').pop();
    const response = await apiClient.post(`/api/asana/${encodeURIComponent(shortId)}/same-as`, {
      target_asana_id: targetShortId,
    });
    return response.data;
  },

  removeSameAsObject: async (asanaId, targetAsanaId) => {
    const shortId = asanaId.split('#').pop();
    const targetShortId = targetAsanaId.split('#').pop();
    const response = await apiClient.delete(`/api/asana/${encodeURIComponent(shortId)}/same-as/${encodeURIComponent(targetShortId)}`);
    return response.data;
  },

  replacePhoto: async (asanaId, photoId, photoFile) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    
    // Обрабатываем разные форматы ID
    let shortId = asanaId;
    if (asanaId.includes('#')) {
      shortId = asanaId.split('#').pop();
    }
    shortId = shortId.replace('asana_', '');
    
    let shortPhotoId = photoId;
    if (photoId.includes('#')) {
      shortPhotoId = photoId.split('#').pop();
    }
    shortPhotoId = shortPhotoId.replace('photo_', '');
    
    const response = await apiClient.put(
      `/api/asana/${encodeURIComponent(shortId)}/photo/${encodeURIComponent(shortPhotoId)}`,
      formData,
      formDataConfig
    );
    return response.data;
  },

  /** degrees: 90 | 180 | 270 — по часовой стрелке (см. бэкенд). Query, не FormData: иначе с axios default Content-Type: application/json поле degrees не доходило до FastAPI. */
  rotatePhoto: async (asanaId, photoId, degrees) => {
    let shortId = asanaId;
    if (asanaId.includes('#')) {
      shortId = asanaId.split('#').pop();
    }
    shortId = shortId.replace('asana_', '');

    let shortPhotoId = photoId;
    if (photoId.includes('#')) {
      shortPhotoId = photoId.split('#').pop();
    }
    shortPhotoId = shortPhotoId.replace('photo_', '');

    const q = new URLSearchParams({ degrees: String(degrees) });
    const response = await apiClient.post(
      `/api/asana/${encodeURIComponent(shortId)}/photo/${encodeURIComponent(shortPhotoId)}/rotate?${q.toString()}`
    );
    return response.data;
  },

  deletePhoto: async (asanaId, photoId) => {
    // Обрабатываем разные форматы ID
    let shortId = asanaId;
    if (asanaId.includes('#')) {
      shortId = asanaId.split('#').pop();
    }
    shortId = shortId.replace('asana_', '');
    
    let shortPhotoId = photoId;
    if (photoId.includes('#')) {
      shortPhotoId = photoId.split('#').pop();
    }
    shortPhotoId = shortPhotoId.replace('photo_', '');
    
    const response = await apiClient.delete(`/api/asana/${encodeURIComponent(shortId)}/photo/${encodeURIComponent(shortPhotoId)}`);
    return response.data;
  },
};
