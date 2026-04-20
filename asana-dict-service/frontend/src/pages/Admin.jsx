import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UsersManagement from '../components/admin/UsersManagement';
import AsanaNamesAdmin from '../components/admin/AsanaNamesAdmin';
import '../styles/Admin.css';

const SECTIONS = {
  users: 'users',
  names: 'names',
};

const Admin = () => {
  const { isAdmin, isExpertOrAdmin } = useAuth();
  const [openSection, setOpenSection] = useState(SECTIONS.users);

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  if (!isExpertOrAdmin) {
    return (
      <div className="container">
        <div className="error-message">
          Доступ запрещён. Требуется роль эксперта или администратора.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container admin-page admin-page--expert-names">
        <h1 className="admin-title">Названия асан</h1>
        <p className="admin-page-lead">
          Справочник названий: добавление, редактирование и удаление записей. Раздел
          «Пользователи» в этой панели доступен только администратору.
        </p>
        <AsanaNamesAdmin />
      </div>
    );
  }

  return (
    <div className="container admin-page">
      <h1 className="admin-title">Администрирование</h1>

      <div className="admin-accordion" role="navigation" aria-label="Разделы администрирования">
        <section className="admin-section">
          <button
            type="button"
            className={`admin-section-header ${openSection === SECTIONS.users ? 'is-open' : ''}`}
            onClick={() => toggleSection(SECTIONS.users)}
            aria-expanded={openSection === SECTIONS.users}
            id="admin-head-users"
          >
            <span className="admin-section-title">Пользователи</span>
            <span className="admin-section-chevron" aria-hidden>
              {openSection === SECTIONS.users ? '▼' : '▶'}
            </span>
          </button>
          <div className="admin-section-panel" role="region" aria-labelledby="admin-head-users">
            {openSection === SECTIONS.users && <UsersManagement />}
          </div>
        </section>

        <section className="admin-section">
          <button
            type="button"
            className={`admin-section-header ${openSection === SECTIONS.names ? 'is-open' : ''}`}
            onClick={() => toggleSection(SECTIONS.names)}
            aria-expanded={openSection === SECTIONS.names}
            id="admin-head-names"
          >
            <span className="admin-section-title">Названия асан</span>
            <span className="admin-section-chevron" aria-hidden>
              {openSection === SECTIONS.names ? '▼' : '▶'}
            </span>
          </button>
          <div className="admin-section-panel" role="region" aria-labelledby="admin-head-names">
            {openSection === SECTIONS.names && <AsanaNamesAdmin />}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Admin;
