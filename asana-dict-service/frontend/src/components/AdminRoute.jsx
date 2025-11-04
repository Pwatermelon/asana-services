import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return isAdmin ? children : <Navigate to="/login" replace />;
};

export default AdminRoute;

