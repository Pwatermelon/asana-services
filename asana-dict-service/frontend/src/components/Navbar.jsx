import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const { isAuthenticated, isAdmin, isExpertOrAdmin, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {isAuthenticated && (
        <div className="user-role-badge-fixed">
          <span>{localStorage.getItem('user_role')?.toUpperCase() || ''}</span>
        </div>
      )}
      <nav className="navbar">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand">
            Каталог<br />Асан
          </Link>
          <div className="navbar-links">
            <Link
              to="/asanas"
              className={`nav-link ${isActive('/asanas') ? 'active' : ''}`}
            >
              Каталог асан
            </Link>
            <Link
              to="/sources"
              className={`nav-link ${isActive('/sources') ? 'active' : ''}`}
            >
              Источники
            </Link>
            {isAdmin && (
              <Link
                to="/settings"
                className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
              >
                Настройки
              </Link>
            )}
            <Link
              to="/about"
              className={`nav-link ${isActive('/about') ? 'active' : ''}`}
            >
              О проекте
            </Link>
            {isExpertOrAdmin && (
              <Link
                to="/expert-instructions"
                className={`nav-link ${isActive('/expert-instructions') ? 'active' : ''}`}
              >
                Инструкции
              </Link>
            )}
          </div>
          <div className="navbar-actions">
            {isExpertOrAdmin && (
              <>
                <Link to="/asana/add" className="btn-primary">
                  Добавить асану
                </Link>
                <Link to="/sources/add" className="btn-primary">
                  Добавить источник
                </Link>
              </>
            )}
            {isAuthenticated ? (
              <Link to="/login" onClick={logout} className="btn-logout">
                <span style={{ fontSize: '1.1em' }}>⎋</span> Выйти
              </Link>
            ) : (
              <Link to="/login" className="btn-primary">
                Войти
              </Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;

