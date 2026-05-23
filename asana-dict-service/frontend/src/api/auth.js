import apiClient from './client';

/** Нормализация флагов из /api/users/me (разные форматы JSON / полей). */
function roleFromUserMe(user) {
  if (!user || typeof user !== 'object') return null;
  const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
  const roleStr = user.role || user.user_role;
  if (truthy(user.is_admin) || truthy(user.isAdmin) || roleStr === 'admin') return 'admin';
  if (truthy(user.permission_study) || truthy(user.permissionStudy) || roleStr === 'expert') {
    return 'expert';
  }
  return null;
}

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
      return roleFromUserMe(response.data);
    } catch (error) {
      console.error('Failed to get user role:', error);
      return null; // Неавторизованный пользователь
    }
  },

  confirmRegistration: async (token) => {
    // server-module использует GET /api/auth/verify/{token}
    const response = await apiClient.get(`/api/auth/verify/${token}`);
    return response.data;
  },

  resetPasswordRequest: async (login) => {
    const response = await apiClient.post('/api/auth/reset_password_request', { login });
    return response.data;
  },

  verifyResetCode: async (login, code) => {
    const response = await apiClient.post('/api/auth/reset_password_verify', { login, code });
    return response.data;
  },

  resetPasswordConfirm: async (login, code, newPassword) => {
    const response = await apiClient.patch('/api/auth/reset_password', {
      login,
      code,
      password: newPassword,
    });
    return response.data;
  },

  changeMyPassword: async (currentPassword, newPassword) => {
    const response = await apiClient.patch('/api/users/me/password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  updateMyAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.patch('/api/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteMyAvatar: async () => {
    const response = await apiClient.delete('/api/users/me/avatar');
    return response.data;
  },

  logout: async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // cookie httponly — без API не сбросить
    }
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
        const role = roleFromUserMe(response.data);
        
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

