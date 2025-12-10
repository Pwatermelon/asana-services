import apiClient from './client';

export const usersAPI = {
  getAllUsers: async () => {
    const response = await apiClient.get('/api/users');
    return response.data;
  },

  createUser: async (userData) => {
    const response = await apiClient.post('/api/users', userData);
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await apiClient.patch(`/api/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await apiClient.delete(`/api/users/${userId}`);
    return response.data;
  },
};







