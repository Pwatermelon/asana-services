import apiClient from './client';

/** Импорт файлов: совпадает с глобальным VITE_API_TIMEOUT_MS или отдельный VITE_IMPORT_TIMEOUT_MS. */
const _importT = Number(import.meta.env?.VITE_IMPORT_TIMEOUT_MS);
const _apiT = Number(import.meta.env?.VITE_API_TIMEOUT_MS);
const IMPORT_FILE_TIMEOUT_MS =
  Number.isFinite(_importT) && _importT > 0
    ? _importT
    : Number.isFinite(_apiT) && _apiT > 0
      ? _apiT
      : 3600000;

/** Опрос /api/import/status — короткий таймаут: при залипшем TCP сразу новый запрос, а не pending на час. */
const _statusPollT = Number(import.meta.env?.VITE_IMPORT_STATUS_TIMEOUT_MS);
const IMPORT_STATUS_POLL_TIMEOUT_MS =
  Number.isFinite(_statusPollT) && _statusPollT > 0 ? _statusPollT : 15000;

export const settingsAPI = {
  uploadOntology: async (file) => {
    const formData = new FormData();
    formData.append('ontology_file', file);
    const response = await apiClient.post('/api/upload-ontology', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: IMPORT_FILE_TIMEOUT_MS,
    });
    return response.data;
  },

  downloadOntology: async () => {
    const response = await apiClient.get('/api/download-ontology', {
      responseType: 'blob', // Важно для скачивания файла
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'asana_ontology.owl');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  importAsanas: async (file, sourceId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_id', sourceId);
    
    const response = await apiClient.post('/api/import/asanas', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: IMPORT_FILE_TIMEOUT_MS,
    });
    return response.data;
  },

  scanFullImport: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/api/import/full/scan', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: IMPORT_FILE_TIMEOUT_MS,
    });
    return response.data;
  },

  importFull: async (file, sourceMapping = null) => {
    const formData = new FormData();
    formData.append('file', file);
    // Всегда передаем маппинг, если он передан (может содержать 'new' для создания новых источников)
    if (sourceMapping) {
      formData.append('source_mapping', JSON.stringify(sourceMapping));
    }
    
    const response = await apiClient.post('/api/import/full', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: IMPORT_FILE_TIMEOUT_MS,
    });
    return response.data;
  },
  
  getModerationCount: async () => {
    const response = await apiClient.get('/api/moderation/items/count');
    return response.data;
  },

  importAsanaNames: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/api/import/asana-names', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: IMPORT_FILE_TIMEOUT_MS,
    });
    return response.data;
  },

  /** Тот же формат колонок, что и при импорте названий (эксперт / админ). */
  exportAsanaNames: async () => {
    const response = await apiClient.get('/api/export/asana-names', {
      responseType: 'blob',
    });
    let filename = 'asana_names.xlsx';
    const cd = response.headers['content-disposition'];
    if (cd && cd.includes('filename=')) {
      const m = cd.match(/filename="([^"]+)"/);
      if (m) filename = m[1];
    }
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },

  getImportStatus: async (taskId) => {
    const response = await apiClient.get(`/api/import/status/${taskId}`, {
      timeout: IMPORT_STATUS_POLL_TIMEOUT_MS,
      // Сброс кэша: на проде прокси/CDN иногда отдают один и тот же JSON — прогресс «застывает»
      params: { _t: Date.now() },
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });
    return response.data;
  },
};

