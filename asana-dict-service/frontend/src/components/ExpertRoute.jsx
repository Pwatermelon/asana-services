import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ExpertRoute = ({ children }) => {
  const { isExpertOrAdmin, loading } = useAuth();

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return isExpertOrAdmin ? children : <Navigate to="/login" replace />;
};

export default ExpertRoute;

