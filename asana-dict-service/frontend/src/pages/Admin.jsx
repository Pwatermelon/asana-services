import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UsersManagement from '../components/admin/UsersManagement';
import '../styles/Admin.css';

const Admin = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/asanas" replace />;
  }

  return (
    <div className="container admin-page">
      <h1 className="admin-title">Администрирование</h1>
      <p className="admin-page-lead">
        Управление пользователями. Справочник названий асан — в разделе «Названия» в верхнем меню.
      </p>
      <div className="admin-nested">
        <UsersManagement />
      </div>
    </div>
  );
};

export default Admin;
