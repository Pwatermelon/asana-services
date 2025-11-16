import apiClient from './client';

export const settingsAPI = {
  uploadOntology: async (file) => {
    const formData = new FormData();
    formData.append('ontology_file', file);
    const response = await apiClient.post('/api/upload-ontology', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
    });
    return response.data;
  },

  importFull: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/api/import/full', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
    });
    return response.data;
  },

  getImportStatus: async (taskId) => {
    const response = await apiClient.get(`/api/import/status/${taskId}`);
    return response.data;
  },
};

