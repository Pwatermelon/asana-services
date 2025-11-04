import apiClient from './client';

export const authAPI = {
  login: async (username, password, rememberMe = false) => {
    const response = await apiClient.post('/login', {
      username,
      password,
      remember_me: rememberMe,
    });
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('user_role', response.data.role);
    }
    return response.data;
  },

  register: async (username, email, firstName, lastName, password) => {
    const response = await apiClient.post('/register', {
      username,
      email,
      first_name: firstName,
      last_name: lastName,
      password,
    });
    return response.data;
  },

  confirmRegistration: async (code) => {
    const response = await apiClient.post('/confirm-registration', { code });
    return response.data;
  },

  resetPasswordRequest: async (email) => {
    const response = await apiClient.post('/reset-password-request', { email });
    return response.data;
  },

  resetPasswordConfirm: async (code, newPassword) => {
    const response = await apiClient.post('/reset-password-confirm', {
      code,
      new_password: newPassword,
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return { isAuthenticated: false, role: null };
      }
      
      // Проверяем токен через API
      const response = await apiClient.get('/api/auth/check');
      // Бэкенд возвращает is_authenticated (snake_case)
      const isAuth = response.data.is_authenticated !== undefined 
        ? response.data.is_authenticated 
        : response.data.isAuthenticated;
      
      if (isAuth && response.data.role) {
        // Обновляем роль в localStorage
        localStorage.setItem('user_role', response.data.role);
        return { 
          isAuthenticated: true, 
          role: response.data.role 
        };
      } else {
        // Токен невалиден, очищаем
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        return { isAuthenticated: false, role: null };
      }
    } catch (error) {
      // Если ошибка 401 или токен невалиден, очищаем
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
      }
      return { isAuthenticated: false, role: null };
    }
  },
};

