import axios from 'axios';

// Используем относительные пути - nginx проксирует запросы к бэкенду
const API_BASE_URL = '';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерсептор для добавления токена и схемы БД к запросам
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = window.localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // Добавляем заголовок схемы БД для запросов к server-module (все /api/auth и /api/users)
      if (config.url && (config.url.startsWith('/api/auth') || config.url.startsWith('/api/users'))) {
        config.headers['X-DB-Schema'] = 'dict_schema';
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерсептор для обработки ошибок авторизации
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        if (window.localStorage) {
          window.localStorage.removeItem('access_token');
          window.localStorage.removeItem('user_role');
        }
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

