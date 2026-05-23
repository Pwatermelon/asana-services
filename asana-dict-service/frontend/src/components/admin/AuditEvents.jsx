import React, { useEffect, useState } from 'react';
import { auditAPI } from '../../api/audit';
import { usersAPI } from '../../api/users';
import '../../styles/AuditEvents.css';

const RETENTION_DAYS = 7;

const formatDetails = (item) => {
  if (!item.details) return null;
  try {
    const d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
    const target = d.target || {};
    const chips = [];
    if (d.actor_role === 'admin') chips.push({ k: 'Роль', v: 'Администратор' });
    if (d.actor_role === 'expert') chips.push({ k: 'Роль', v: 'Эксперт' });
    if (target.name_ru) chips.push({ k: 'Название', v: target.name_ru });
    if (target.title) chips.push({ k: 'Источник', v: target.title });
    if (target.login) chips.push({ k: 'Логин', v: target.login });
    if (target.email) chips.push({ k: 'Email', v: target.email });
    if (target.uri) chips.push({ k: 'URI', v: target.uri });
    if (target.asana_id) chips.push({ k: 'Асана', v: target.asana_id });
    if (target.user_id) chips.push({ k: 'User ID', v: target.user_id });
    return chips.length ? chips : null;
  } catch {
    return null;
  }
};

const AuditEvents = () => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [staffUsers, setStaffUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginFilter, setLoginFilter] = useState('');

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const fromTs = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const data = await auditAPI.getEvents({
        login: loginFilter || undefined,
        from_ts: fromTs,
        limit: 300,
      });
      setItems(data.items || []);
      setTotal(data.total ?? (data.items || []).length);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить аудит действий.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    usersAPI
      .getAllUsers()
      .then((users) => {
        const staff = (users || []).filter((u) => u.is_admin || u.permission_study);
        setStaffUsers(staff);
      })
      .catch(() => setStaffUsers([]));
    loadEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="audit-events">
      <div className="audit-events-header">
        <div>
          <h2>Журнал действий</h2>
          <p className="audit-events-subtitle">
            Только администраторы и эксперты · последние {RETENTION_DAYS} дней · {total} записей
          </p>
        </div>
        <div className="audit-events-controls">
          <select
            value={loginFilter}
            onChange={(e) => setLoginFilter(e.target.value)}
            aria-label="Фильтр по пользователю"
          >
            <option value="">Все сотрудники</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.login}>
                {u.login}
                {u.is_admin ? ' (админ)' : ' (эксперт)'}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Или введите логин"
            value={loginFilter}
            onChange={(e) => setLoginFilter(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={loadEvents}>
            Обновить
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {loading && <div className="loading">Загрузка аудита...</div>}

      {!loading && (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Подробности</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const chips = formatDetails(item);
                const summary = item.summary || item.action_code;
                return (
                  <tr key={item.id}>
                    <td className="audit-cell-time">{item.timestamp?.replace('T', ' ').slice(0, 19)}</td>
                    <td>
                      <div className="audit-user-cell">
                        {item.avatar_url ? (
                          <img src={item.avatar_url} alt="avatar" className="audit-avatar" />
                        ) : (
                          <div className="audit-avatar-fallback">
                            {(item.login || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span>{item.login}</span>
                      </div>
                    </td>
                    <td>
                      <div className="audit-action-title">{summary}</div>
                    </td>
                    <td>
                      {chips ? (
                        <ul className="audit-details-list">
                          {chips.map((c) => (
                            <li key={`${c.k}-${c.v}`}>
                              <span className="audit-details-key">{c.k}:</span> {c.v}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="audit-details-empty">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="audit-empty">
                    За последние {RETENTION_DAYS} дней действий не найдено.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default AuditEvents;
