import axios from 'axios';

// Используем относительные пути - nginx проксирует запросы к бэкенду
const API_BASE_URL = '';

/** Глобальный лимит axios (мс). Раньше 300000 → «timeout of 300000ms exceeded» на проде при долгом импорте/экспорте/опросе с тяжёлым ответом. */
const _apiTimeout = Number(import.meta.env?.VITE_API_TIMEOUT_MS);
const API_TIMEOUT_MS =
  Number.isFinite(_apiTimeout) && _apiTimeout > 0 ? _apiTimeout : 3600000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT_MS,
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

