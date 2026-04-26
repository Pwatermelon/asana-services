import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SourcesList.css';

const SourcesList = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { isExpertOrAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const data = await sourcesAPI.getAll();
      data.sort((a, b) => (a.author || '').localeCompare(b.author || '', 'ru'));
      setSources(data);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceId = (source) => {
    const raw = source.id.split('#').pop() || source.id;
    return String(raw).replace(/^source_/, '');
  };

  const asanasPath = (source) => `/sources/${getSourceId(source)}/asanas`;

  const rowTitle = (source) => {
    const bits = [source.title, source.year != null && source.year !== '' ? String(source.year) : null, source.author]
      .filter(Boolean)
      .join(' · ');
    return bits;
  };

  const handleDelete = async (e, source) => {
    e.stopPropagation();
    if (!window.confirm(`Удалить источник «${source.title}»?`)) {
      return;
    }
    try {
      await sourcesAPI.delete(source.id);
      loadSources();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка при удалении источника');
      console.error('Error deleting source:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadSources();
      return;
    }
    try {
      const results = await sourcesAPI.search(searchQuery);
      setSources(results);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Источники</h1>

        <div className="search-form-container sources-search-wrap">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск источников…"
                className="search-input"
              />
              <button type="submit" className="search-button">
                Найти
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="sources-lines">
        {sources.map((source) => (
          <div key={source.id} className="source-line">
            <div
              className="source-line-click"
              role="button"
              tabIndex={0}
              title={rowTitle(source)}
              onClick={() => navigate(asanasPath(source))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(asanasPath(source));
                }
              }}
            >
              <span className="source-line-title">{source.title || '—'}</span>
              <span className="source-line-sep" aria-hidden>
                ·
              </span>
              <span className="source-line-year">
                {source.year != null && source.year !== '' ? source.year : '—'}
              </span>
              <span className="source-line-sep" aria-hidden>
                ·
              </span>
              <span className="source-line-author">{source.author || '—'}</span>
              {source.publisher ? (
                <>
                  <span className="source-line-sep source-line-sep--soft" aria-hidden>
                    ·
                  </span>
                  <span className="source-line-extra">{source.publisher}</span>
                </>
              ) : null}
            </div>

            {isExpertOrAdmin && (
              <div className="source-line-actions" onClick={(e) => e.stopPropagation()}>
                <Link
                  to={`/sources/${getSourceId(source)}/edit`}
                  className="btn-source-line btn-source-line--edit"
                  onClick={(e) => e.stopPropagation()}
                >
                  Изменить
                </Link>
                <button
                  type="button"
                  className="btn-source-line btn-source-line--del"
                  onClick={(e) => handleDelete(e, source)}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourcesList;
