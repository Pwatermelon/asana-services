import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../../api/analytics';
import '../../styles/NavigationAnalytics.css';

const NavigationAnalytics = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (period = days) => {
    try {
      setLoading(true);
      setError('');
      const summary = await analyticsAPI.getNavSummary(period);
      setData(summary);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить анализ навигации.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="nav-analytics">
      <div className="nav-analytics-header">
        <div>
          <h2>Анализ навигации (AsanaNavPath)</h2>
          <p className="nav-analytics-subtitle">
            Цепи Маркова, частые маршруты и статистика страниц каталога
            {data
              ? ` · ${data.event_count || 0} просмотров · ${data.session_count || 0} сессий`
              : ''}
          </p>
        </div>
        <div className="nav-analytics-controls">
          <select
            value={days}
            onChange={(e) => {
              const v = Number(e.target.value);
              setDays(v);
              load(v);
            }}
            aria-label="Период"
          >
            <option value={1}>1 день</option>
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
          <button type="button" className="btn-secondary" onClick={() => load(days)}>
            Обновить
          </button>
        </div>
      </div>

      {loading && <p className="nav-analytics-status">Загрузка…</p>}
      {error && <p className="nav-analytics-error">{error}</p>}

      {!loading && data && (
        <>
          {Array.isArray(data.insights) && data.insights.length > 0 && (
            <ul className="nav-analytics-insights">
              {data.insights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}

          {data.adaptive && (
            <div className="nav-analytics-block nav-analytics-block--wide" style={{ marginBottom: 16 }}>
              <h3>Адаптация приложения (замкнутый контур)</h3>
              <p className="nav-analytics-subtitle">
                {data.adaptive.adaptive_enabled
                  ? 'Правила активны: интерфейс меняется по статистике навигации.'
                  : 'Режим наблюдения — накопление данных до порога включения.'}
              </p>
              <ul className="nav-analytics-insights">
                {(data.adaptive.applied_rules || []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="nav-analytics-grid">
            <div className="nav-analytics-block">
              <h3>Топ страниц</h3>
              <div className="nav-table-wrap">
                <table className="nav-table">
                  <thead>
                    <tr>
                      <th>Паттерн</th>
                      <th>Просмотры</th>
                      <th>Сессии</th>
                      <th>Входы</th>
                      <th>Выходы</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pages || []).slice(0, 20).map((row) => (
                      <tr key={row.page}>
                        <td>
                          <code>{row.page}</code>
                        </td>
                        <td>{row.views}</td>
                        <td>{row.unique_sessions}</td>
                        <td>{row.entries}</td>
                        <td>{row.exits}</td>
                      </tr>
                    ))}
                    {!(data.pages || []).length && (
                      <tr>
                        <td colSpan={5}>Пока нет данных — походите по каталогу.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="nav-analytics-block">
              <h3>Переходы (Markov 1-го порядка)</h3>
              <div className="nav-table-wrap">
                <table className="nav-table">
                  <thead>
                    <tr>
                      <th>Из</th>
                      <th>В</th>
                      <th>N</th>
                      <th>P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.transitions || []).slice(0, 20).map((row) => (
                      <tr key={`${row.from}->${row.to}`}>
                        <td>
                          <code>{row.from}</code>
                        </td>
                        <td>
                          <code>{row.to}</code>
                        </td>
                        <td>{row.count}</td>
                        <td>{row.probability}</td>
                      </tr>
                    ))}
                    {!(data.transitions || []).length && (
                      <tr>
                        <td colSpan={4}>Нет переходов за период.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="nav-analytics-block nav-analytics-block--wide">
              <h3>Частые маршруты</h3>
              <div className="nav-table-wrap">
                <table className="nav-table">
                  <thead>
                    <tr>
                      <th>Маршрут</th>
                      <th>Длина</th>
                      <th>N</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.routes || []).slice(0, 20).map((row) => (
                      <tr key={row.route_label}>
                        <td>
                          <code>{row.route_label}</code>
                        </td>
                        <td>{row.length}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                    {!(data.routes || []).length && (
                      <tr>
                        <td colSpan={3}>Маршруты появятся после нескольких сессий.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default NavigationAnalytics;
