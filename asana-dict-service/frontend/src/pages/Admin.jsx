import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UsersManagement from '../components/admin/UsersManagement';
import AuditEvents from '../components/admin/AuditEvents';
import '../styles/Admin.css';

const Admin = () => {
  const { isAdmin } = useAuth();
  const [openSections, setOpenSections] = useState({
    links: true,
    users: true,
    audit: false,
  });
  const accessToken = window.localStorage.getItem('access_token');
  const baseUrl = `${window.location.protocol}//${window.location.hostname}`;

  const monitoringUrl = (targetPath) => {
    if (!accessToken) {
      return `${baseUrl}/login?next=${encodeURIComponent(targetPath)}`;
    }
    const params = new URLSearchParams({
      access_token: accessToken,
      next: targetPath,
    });
    return `${baseUrl}/api/auth/monitoring-session?${params.toString()}`;
  };

  const grafanaUrl = monitoringUrl('/grafana/');
  const kibanaUrl = monitoringUrl('/kibana/');
  const swaggerUrl = accessToken
    ? `${baseUrl}/api/docs?access_token=${encodeURIComponent(accessToken)}`
    : `${baseUrl}/login?next=${encodeURIComponent('/api/docs')}`;

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!isAdmin) {
    return <Navigate to="/asanas" replace />;
  }

  return (
    <div className="container admin-page">
      <h1 className="admin-title">Администрирование</h1>
      <p className="admin-page-lead">
        Управление пользователями. Справочник названий асан — в разделе «Названия» в верхнем меню.
      </p>
      <div className="admin-accordion">
        <section className="admin-section">
          <button
            type="button"
            className={`admin-section-header ${openSections.links ? 'is-open' : ''}`}
            onClick={() => toggleSection('links')}
            aria-expanded={openSections.links}
          >
            <span className="admin-section-title">Инструменты администрирования</span>
            <span className="admin-section-chevron">{openSections.links ? '▼' : '▶'}</span>
          </button>
          {openSections.links && (
            <div className="admin-section-panel">
              <div className="admin-links-row">
                <a
                  href={grafanaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link-card admin-link-card--grafana"
                >
                  <span className="admin-link-card__icon">G</span>
                  <span className="admin-link-card__content">
                    <span className="admin-link-card__title">Grafana</span>
                    <span className="admin-link-card__subtitle">Мониторинг сервисов, API и инфраструктуры</span>
                  </span>
                  <span className="admin-link-card__arrow" aria-hidden="true">→</span>
                </a>
                <a
                  href={swaggerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link-card admin-link-card--swagger"
                >
                  <span className="admin-link-card__icon">API</span>
                  <span className="admin-link-card__content">
                    <span className="admin-link-card__title">Swagger API</span>
                    <span className="admin-link-card__subtitle">Документация эндпоинтов, доступ только для админа</span>
                  </span>
                  <span className="admin-link-card__arrow" aria-hidden="true">→</span>
                </a>
                <a
                  href={kibanaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link-card admin-link-card--kibana"
                >
                  <span className="admin-link-card__icon">LOG</span>
                  <span className="admin-link-card__content">
                    <span className="admin-link-card__title">Kibana Logs</span>
                    <span className="admin-link-card__subtitle">Просмотр логов сервисов и поиск по ошибкам</span>
                  </span>
                  <span className="admin-link-card__arrow" aria-hidden="true">→</span>
                </a>
              </div>
            </div>
          )}
        </section>

        <section className="admin-section">
          <button
            type="button"
            className={`admin-section-header ${openSections.users ? 'is-open' : ''}`}
            onClick={() => toggleSection('users')}
            aria-expanded={openSections.users}
          >
            <span className="admin-section-title">Управление пользователями</span>
            <span className="admin-section-chevron">{openSections.users ? '▼' : '▶'}</span>
          </button>
          {openSections.users && (
            <div className="admin-section-panel">
              <div className="admin-nested">
                <UsersManagement />
              </div>
            </div>
          )}
        </section>

        <section className="admin-section">
          <button
            type="button"
            className={`admin-section-header ${openSections.audit ? 'is-open' : ''}`}
            onClick={() => toggleSection('audit')}
            aria-expanded={openSections.audit}
          >
            <span className="admin-section-title">Аудит действий</span>
            <span className="admin-section-chevron">{openSections.audit ? '▼' : '▶'}</span>
          </button>
          {openSections.audit && (
            <div className="admin-section-panel">
              <div className="admin-nested">
                <AuditEvents />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Admin;
