import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../api/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const authData = await authAPI.checkAuth();
      if (authData.isAuthenticated && authData.role) {
        // Устанавливаем пользователя даже если это guest
        setUser({ role: authData.role });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, rememberMe) => {
    try {
      const data = await authAPI.login(username, password, rememberMe);
      // После успешного логина проверяем авторизацию через API
      // чтобы убедиться что токен валиден и получить актуальную роль
      const authData = await authAPI.checkAuth();
      if (authData.isAuthenticated) {
        setUser({ role: authData.role });
        return { success: true };
      } else {
        return {
          success: false,
          error: 'Не удалось подтвердить авторизацию',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Ошибка входа',
      };
    }
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isExpert: user?.role === 'expert',
    isExpertOrAdmin: user?.role === 'admin' || user?.role === 'expert',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

