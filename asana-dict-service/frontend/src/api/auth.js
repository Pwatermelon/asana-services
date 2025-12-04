import apiClient from './client';

export const authAPI = {
  login: async (username, password, rememberMe = false) => {
    // Используем эндпоинт server-module через nginx прокси
    const response = await apiClient.post('/api/auth', {
      login: username,  // server-module использует login, а не username
      password,
    });
    if (response.data.access_token) {
      localStorage.setItem('access_token', response.data.access_token);
      // Получаем роль из токена или из API /api/users/me
      const userRole = await authAPI.getUserRole(response.data.access_token);
      if (userRole) {
        localStorage.setItem('user_role', userRole);
      }
    }
    return response.data;
  },

  getUserRole: async (token) => {
    try {
      const response = await apiClient.get('/api/users/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = response.data;
      // Маппинг: is_admin → admin, permission_study → expert, иначе → null (неавторизованный)
      if (user.is_admin) return 'admin';
      if (user.permission_study) return 'expert';
      return null; // Обычный пользователь = неавторизованный
    } catch (error) {
      console.error('Failed to get user role:', error);
      return null; // Неавторизованный пользователь
    }
  },

  register: async (username, email, password) => {
    // server-module использует login, mail, password
    const response = await apiClient.post('/api/auth/registration', {
      login: username,
      mail: email,
      password,
    });
    return response.data;
  },

  confirmRegistration: async (token) => {
    // server-module использует GET /api/auth/verify/{token}
    const response = await apiClient.get(`/api/auth/verify/${token}`);
    return response.data;
  },

  resetPasswordRequest: async (login) => {
    // server-module использует GET /api/auth/reset_password_request?login={login}
    const response = await apiClient.get(`/api/auth/reset_password_request?login=${encodeURIComponent(login)}`);
    return response.data;
  },

  resetPasswordConfirm: async (token, newPassword) => {
    // server-module использует PATCH /api/auth/reset_password
    const response = await apiClient.patch('/api/auth/reset_password', {
      token,
      password: newPassword,
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
  },

  getUserInfo: async () => {
    try {
      const response = await apiClient.get('/api/users/me');
      return response.data;
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        return { isAuthenticated: false, role: null };
      }
      
      // Проверяем токен через server-module API /api/users/me
      try {
        const response = await apiClient.get('/api/users/me');
        const user = response.data;
        // Маппинг ролей: is_admin → admin, permission_study → expert, иначе → null (неавторизованный)
        let role = null;
        if (user.is_admin) role = 'admin';
        else if (user.permission_study) role = 'expert';
        
        if (role) {
          localStorage.setItem('user_role', role);
          return { 
            isAuthenticated: true, 
            role: role 
          };
        } else {
          // Обычный пользователь = неавторизованный
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_role');
          return { isAuthenticated: false, role: null };
        }
      } catch (error) {
        // Если токен невалиден (401), очищаем
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_role');
        }
        return { isAuthenticated: false, role: null };
      }
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_role');
      return { isAuthenticated: false, role: null };
    }
  },
};

