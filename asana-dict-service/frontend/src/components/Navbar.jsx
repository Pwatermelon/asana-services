import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { moderationAPI } from '../api/moderation';
import { aiAPI } from '../api/ai';
import '../styles/Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isExpertOrAdmin, logout, user } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);
  const [aiPendingCount, setAiPendingCount] = useState(0);
  const dropdownRef = useRef(null);
  const addMenuRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

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
      const interval = setInterval(loadModerationCount, 30000);
      const onModerationUpdated = () => {
        loadModerationCount();
      };
      window.addEventListener('moderation-updated', onModerationUpdated);
      return () => {
        clearInterval(interval);
        window.removeEventListener('moderation-updated', onModerationUpdated);
      };
    }
    return undefined;
  }, [isExpertOrAdmin]);

  // Счётчик ИИ-модерации (количество предложений в статусе pending)
  useEffect(() => {
    if (!isExpertOrAdmin) return undefined;
    const loadAiPendingCount = async () => {
      try {
        const data = await aiAPI.getPendingCount();
        setAiPendingCount(data?.count || 0);
      } catch (error) {
        console.error('Error loading AI moderation count:', error);
      }
    };
    loadAiPendingCount();
    const interval = setInterval(loadAiPendingCount, 30000);
    const onAiUpdated = () => loadAiPendingCount();
    window.addEventListener('ai-moderation-updated', onAiUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('ai-moderation-updated', onAiUpdated);
    };
  }, [isExpertOrAdmin]);

  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname, closeMobileMenu]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeMobileMenu();
    };
    setIsDropdownOpen(false);
    setIsAddMenuOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isMobileMenuOpen, closeMobileMenu]);

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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsDropdownOpen(false);
    closeMobileMenu();
  };

  const getRoleLabel = () => {
    if (!user) return null;
    if (user.role === 'admin') return 'Администратор';
    if (user.role === 'expert') return 'Эксперт';
    return null;
  };

  const getInitials = (login) => {
    if (!login) return '?';
    return login.charAt(0).toUpperCase();
  };

  const renderNavLinks = (variant) => {
    const isMobile = variant === 'mobile';
    const linkClass = isMobile ? 'navbar-mobile-link' : 'nav-link';

    return (
      <>
        <Link
          to="/asanas"
          className={`${linkClass} ${isActive('/asanas') ? 'active' : ''}`}
          onClick={isMobile ? closeMobileMenu : undefined}
        >
          Каталог
        </Link>
        {isExpertOrAdmin && (
          <Link
            to="/names"
            className={`${linkClass} ${isActive('/names') ? 'active' : ''}`}
            onClick={isMobile ? closeMobileMenu : undefined}
          >
            Названия
          </Link>
        )}
        <Link
          to="/sources"
          className={`${linkClass} ${isActive('/sources') ? 'active' : ''}`}
          onClick={isMobile ? closeMobileMenu : undefined}
        >
          Источники
        </Link>
        {isExpertOrAdmin && (
          <Link
            to="/settings"
            className={`${linkClass} ${isActive('/settings') ? 'active' : ''}`}
            onClick={isMobile ? closeMobileMenu : undefined}
          >
            Настройки
          </Link>
        )}
        {isExpertOrAdmin && (
          <Link
            to="/moderation"
            className={`${linkClass} ${isActive('/moderation') ? 'active' : ''}`}
            onClick={isMobile ? closeMobileMenu : undefined}
          >
            {isMobile ? (
              <>
                <span className="navbar-mobile-link-text">Требует модерации</span>
                {moderationCount > 0 && (
                  <span className="moderation-badge">{moderationCount}</span>
                )}
              </>
            ) : (
              <>
                Требует модерации
                {moderationCount > 0 && (
                  <span className="moderation-badge">{moderationCount}</span>
                )}
              </>
            )}
          </Link>
        )}
        {isExpertOrAdmin && (
          <Link
            to="/ai-moderation"
            className={`${linkClass} ${isActive('/ai-moderation') ? 'active' : ''}`}
            onClick={isMobile ? closeMobileMenu : undefined}
            title="Модерация связей isSameAs, найденных нейросетью"
          >
            {isMobile ? (
              <>
                <span className="navbar-mobile-link-text">ИИ</span>
                {aiPendingCount > 0 && (
                  <span className="moderation-badge">{aiPendingCount}</span>
                )}
              </>
            ) : (
              <>
                ИИ
                {aiPendingCount > 0 && (
                  <span className="moderation-badge">{aiPendingCount}</span>
                )}
              </>
            )}
          </Link>
        )}
        <Link
          to="/about"
          className={`${linkClass} ${isActive('/about') ? 'active' : ''}`}
          onClick={isMobile ? closeMobileMenu : undefined}
        >
          О проекте
        </Link>
        {isExpertOrAdmin && (
          <Link
            to="/expert-instructions"
            className={`${linkClass} ${isActive('/expert-instructions') ? 'active' : ''}`}
            onClick={isMobile ? closeMobileMenu : undefined}
          >
            Инструкции
          </Link>
        )}
      </>
    );
  };

  return (
    <>
    <nav className="navbar">
      <div className="navbar-content">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-line">Каталог асан</span>
          <span className="navbar-brand-line navbar-brand-line--sub">
            традиционных школ йоги
          </span>
        </Link>
        <div className="navbar-links navbar-links--desktop">{renderNavLinks('desktop')}</div>
        <div className="navbar-actions">
          {isExpertOrAdmin && (
            <div className="navbar-add-wrap navbar-add-wrap--desktop" ref={addMenuRef}>
              <button
                type="button"
                className="navbar-add-trigger"
                onClick={() => setIsAddMenuOpen((o) => !o)}
                aria-expanded={isAddMenuOpen}
                aria-haspopup="menu"
              >
                <span className="navbar-add-plus" aria-hidden>
                  +
                </span>
                <span>Создать</span>
                <span className="navbar-add-chevron">▾</span>
              </button>
              {isAddMenuOpen && (
                <div className="navbar-add-menu" role="menu">
                  <Link
                    to="/asana/add"
                    className="navbar-add-item"
                    role="menuitem"
                    onClick={() => setIsAddMenuOpen(false)}
                  >
                    Новая асана
                  </Link>
                  <Link
                    to="/sources/add"
                    className="navbar-add-item"
                    role="menuitem"
                    onClick={() => setIsAddMenuOpen(false)}
                  >
                    Новый источник
                  </Link>
                </div>
              )}
            </div>
          )}
          {!isAuthenticated && (
            <Link to="/login" className="btn-primary btn-primary--nav">
              Войти
            </Link>
          )}
          {isAuthenticated && (
            <div className="navbar-user-wrap" ref={dropdownRef}>
              <div
                className="user-menu-trigger"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setIsDropdownOpen(!isDropdownOpen);
                  }
                }}
              >
                <div className="user-avatar">{getInitials(user?.login)}</div>
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
                      to="/admin"
                      className="user-dropdown-link"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Админ-панель
                    </Link>
                  )}
                  <button type="button" className="user-dropdown-logout" onClick={handleLogout}>
                    Выйти
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={`navbar-burger ${isMobileMenuOpen ? 'navbar-burger--open' : ''}`}
            aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="navbar-mobile-panel"
            onClick={() => setIsMobileMenuOpen((o) => !o)}
          >
            <span className="navbar-burger-line" />
            <span className="navbar-burger-line" />
            <span className="navbar-burger-line" />
          </button>
        </div>
      </div>
    </nav>

    {isMobileMenuOpen && (
      <>
        <div
          className="navbar-mobile-backdrop"
          aria-hidden
          onClick={closeMobileMenu}
        />
        <div
          id="navbar-mobile-panel"
          className="navbar-mobile-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Меню навигации"
        >
          <div className="navbar-mobile-panel-inner">
            <div className="navbar-mobile-scroll">
              {isExpertOrAdmin && (
                <div className="navbar-mobile-section">
                  <div className="navbar-mobile-section-title">Создать</div>
                  <Link
                    to="/asana/add"
                    className="navbar-mobile-link navbar-mobile-link--sub"
                    onClick={closeMobileMenu}
                  >
                    Новая асана
                  </Link>
                  <Link
                    to="/sources/add"
                    className="navbar-mobile-link navbar-mobile-link--sub"
                    onClick={closeMobileMenu}
                  >
                    Новый источник
                  </Link>
                </div>
              )}
              <div className="navbar-mobile-section">
                <div className="navbar-mobile-section-title">Разделы</div>
                {renderNavLinks('mobile')}
              </div>
              {isAuthenticated && isAdmin && (
                <div className="navbar-mobile-section">
                  <Link
                    to="/admin"
                    className={`navbar-mobile-link ${isActive('/admin') ? 'active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    Админ-панель
                  </Link>
                </div>
              )}
              {isAuthenticated && (
                <button
                  type="button"
                  className="navbar-mobile-logout"
                  onClick={handleLogout}
                >
                  Выйти
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
};

export default Navbar;
