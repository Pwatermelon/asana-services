import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isExpertOrAdmin, logout, user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Закрываем dropdown при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsDropdownOpen(false);
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Администратор',
      expert: 'Эксперт',
      guest: 'Гость'
    };
    return labels[role] || role;
  };

  const getInitials = (login) => {
    if (!login) return '?';
    return login.charAt(0).toUpperCase();
  };

  return (
    <>
      {isAuthenticated && (
        <div className="user-menu-fixed" ref={dropdownRef}>
          <div 
            className="user-menu-trigger"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="user-avatar">
              {getInitials(user?.login)}
            </div>
            <span className="user-login">{user?.login || 'Пользователь'}</span>
            <span className="dropdown-arrow">▼</span>
          </div>
          {isDropdownOpen && (
            <div className="user-dropdown">
              <div className="user-dropdown-role">
                <span className="role-label">Роль:</span>
                <span className="role-value">{getRoleLabel(user?.role)}</span>
              </div>
              <button 
                className="user-dropdown-logout"
                onClick={handleLogout}
              >
                Выйти
              </button>
            </div>
          )}
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
            {!isAuthenticated && (
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

