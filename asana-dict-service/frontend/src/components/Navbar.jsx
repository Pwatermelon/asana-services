import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { moderationAPI } from '../api/moderation';
import '../styles/Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isExpertOrAdmin, logout, user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);
  const dropdownRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Загружаем счетчик модерации
  useEffect(() => {
    if (isExpertOrAdmin) {
      const loadModerationCount = async () => {
        try {
          const data = await moderationAPI.getItemsCount();
          setModerationCount(data.count || 0);
        } catch (error) {
          console.error('Error loading moderation count:', error);
        }
      };
      loadModerationCount();
      // Обновляем счетчик каждые 30 секунд
      const interval = setInterval(loadModerationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isExpertOrAdmin]);

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

  const getRoleLabel = () => {
    if (!user) return null;
    // Используем role из user объекта, а не isAdmin/isExpert
    if (user.role === 'admin') return 'Администратор';
    if (user.role === 'expert') return 'Эксперт';
    return null; // Обычный пользователь = неавторизованный
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
              {getRoleLabel() && (
                <div className="user-dropdown-role">
                  <span className="role-label">Роль:</span>
                  <span className="role-value">{getRoleLabel()}</span>
                </div>
              )}
              {isAdmin && (
                <Link
                  to="/users"
                  className="user-dropdown-link"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Пользователи
                </Link>
              )}
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
            {isExpertOrAdmin && (
              <Link
                to="/settings"
                className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
              >
                Настройки
              </Link>
            )}
            {isExpertOrAdmin && (
              <Link
                to="/moderation"
                className={`nav-link ${isActive('/moderation') ? 'active' : ''}`}
              >
                Требует модерации
                {moderationCount > 0 && (
                  <span className="moderation-badge">{moderationCount}</span>
                )}
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

