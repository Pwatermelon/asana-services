import React, { useEffect, useState } from 'react';
import { auditAPI } from '../../api/audit';
import '../../styles/AuditEvents.css';

const formatDetails = (item) => {
  if (!item.details) return null;
  try {
    const d = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
    const target = d.target || {};
    const chips = [];
    if (target.name_ru) chips.push({ k: 'Название', v: target.name_ru });
    if (target.title) chips.push({ k: 'Источник', v: target.title });
    if (target.login) chips.push({ k: 'Логин', v: target.login });
    if (target.email) chips.push({ k: 'Email', v: target.email });
    if (target.uri) chips.push({ k: 'URI', v: target.uri });
    if (target.asana_id) chips.push({ k: 'Асана', v: target.asana_id });
    if (target.user_id) chips.push({ k: 'User ID', v: target.user_id });
    if (d.query && Object.keys(d.query).length > 0) {
      chips.push({ k: 'Query', v: JSON.stringify(d.query) });
    }
    return chips.length ? chips : null;
  } catch {
    return null;
  }
};

const AuditEvents = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loginFilter, setLoginFilter] = useState('');

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await auditAPI.getEvents({
        login: loginFilter || undefined,
        limit: 200,
      });
      setItems(data.items || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить аудит действий.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="audit-events">
      <div className="audit-events-header">
        <h2>Аудит действий</h2>
        <div className="audit-events-controls">
          <input
            type="text"
            placeholder="Фильтр по логину"
            value={loginFilter}
            onChange={(e) => setLoginFilter(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={loadEvents}>
            Применить
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
                <th>Статус</th>
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
                        <span>{item.login || 'unknown'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="audit-action-title">{summary}</div>
                      <div className="audit-action-meta">
                        {item.method} {item.path}
                        {item.ip ? ` · ${item.ip}` : ''}
                      </div>
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
                        <span className="audit-details-empty">
                          {item.entity_type && item.entity_id
                            ? `${item.entity_type} / ${item.entity_id}`
                            : '—'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`audit-status audit-status--${item.status_code >= 400 ? 'err' : 'ok'}`}>
                        {item.status_code}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="audit-empty">Записи аудита не найдены.</td>
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
